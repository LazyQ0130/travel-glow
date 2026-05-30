const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const prisma = require('../db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const rateLimit = require('../middleware/rate-limit');
const { writeAuditLog } = require('../audit');
const { uploadAvatar, uploadDir, deleteLocalUpload, validateUploadedFiles } = require('../upload');
const { publicUser, ensureUserSettings } = require('../user-utils');
const { buildStats } = require('./stats');
const { verifySmsCode } = require('../sms');
const { AppError } = require('../errors');
const { passwordIssues } = require('../security/password-policy');
const { activeWhere, activePhotosInclude } = require('../services/content-service');

const router = express.Router();

const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyPrefix: 'user-write' });
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'user-sensitive' });

const profileSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  nickname: z.string().trim().min(1).max(30).optional(),
  bio: z.string().trim().max(160).optional(),
  email: z.union([z.literal(''), z.string().trim().email()]).optional()
});

const phoneSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().length(6)
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(1).max(72)
});

const settingsSchema = z.object({
  privacyVisibility: z.enum(['private', 'friends', 'public']).optional(),
  mapTheme: z.enum(['cyber', 'aurora', 'classic']).optional(),
  glowColor: z.enum(['cyan', 'emerald', 'amber', 'violet']).optional(),
  defaultHomeTab: z.enum(['home', 'china', 'world', 'album', 'me']).optional(),
  photoViewMode: z.enum(['timeline', 'grid', 'compact']).optional(),
  language: z.enum(['zh-CN', 'en-US']).optional(),
  distanceUnit: z.enum(['metric', 'imperial']).optional(),
  notificationEnabled: z.boolean().optional(),
  checkinReminder: z.boolean().optional(),
  yearlyReport: z.boolean().optional()
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirmText: z.literal('DELETE')
});

const settingKeys = [
  'privacyVisibility',
  'mapTheme',
  'glowColor',
  'defaultHomeTab',
  'photoViewMode',
  'language',
  'distanceUnit',
  'notificationEnabled',
  'checkinReminder',
  'yearlyReport'
];

function pickSettings(body) {
  return settingKeys.reduce((data, key) => {
    if (body[key] !== undefined) data[key] = body[key];
    return data;
  }, {});
}

async function folderSize(dir) {
  let total = 0;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await folderSize(fullPath);
    } else {
      total += (await fs.promises.stat(fullPath)).size;
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

router.get('/profile', auth, async (req, res, next) => {
  try {
    const settings = await ensureUserSettings(req.user.id);
    res.json({ ...publicUser(req.user), settings });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', auth, writeLimiter, validate(profileSchema), async (req, res, next) => {
  try {
    const { username, nickname, bio, email } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(username !== undefined ? { username: String(username).trim().toLowerCase() } : {}),
        ...(nickname !== undefined ? { nickname } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(email !== undefined ? { email: email ? String(email).trim().toLowerCase() : null, emailVerifiedAt: email ? new Date() : null } : {})
      }
    });
    const settings = await ensureUserSettings(req.user.id);
    await writeAuditLog(req, 'user.profile.update');
    res.json({ ...publicUser(user), settings });
  } catch (error) {
    next(error);
  }
});

router.put('/phone', auth, sensitiveLimiter, validate(phoneSchema), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const cleanPhone = await verifySmsCode({ phone, purpose: 'bind_phone', code });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        phone: cleanPhone,
        phoneVerifiedAt: new Date()
      }
    });
    const settings = await ensureUserSettings(req.user.id);
    await writeAuditLog(req, 'user.phone.update');
    res.json({ ...publicUser(user), settings });
  } catch (error) {
    next(error);
  }
});

router.post('/avatar', auth, writeLimiter, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'Please upload an avatar image.', 'UPLOAD_REQUIRED');
    await validateUploadedFiles([req.file]);
    const avatar = `/uploads/avatars/${req.file.filename}`;
    const oldAvatar = req.user.avatar;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar }
    });
    await deleteLocalUpload(oldAvatar);
    await writeAuditLog(req, 'user.avatar.update');
    res.json({ avatar, user: publicUser(user) });
  } catch (error) {
    if (req.file) await deleteLocalUpload(`/uploads/avatars/${req.file.filename}`);
    next(error);
  }
});

router.put('/password', auth, sensitiveLimiter, validate(passwordSchema), async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const issues = passwordIssues(newPassword);
    if (issues.length) {
      throw new AppError(400, 'Password does not meet strength requirements.', 'WEAK_PASSWORD', issues);
    }
    const ok = await bcrypt.compare(oldPassword || '', req.user.passwordHash);
    if (!ok) throw new AppError(400, 'Old password is incorrect.', 'INVALID_OLD_PASSWORD');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    await prisma.loginSession.updateMany({
      where: {
        userId: req.user.id,
        id: { not: req.session.id },
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
    await writeAuditLog(req, 'user.password.update');
    res.json({ message: 'Password updated.' });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', auth, async (req, res, next) => {
  try {
    res.json(await ensureUserSettings(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.put('/settings', auth, writeLimiter, validate(settingsSchema), async (req, res, next) => {
  try {
    await ensureUserSettings(req.user.id);
    const settings = await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: pickSettings(req.body)
    });
    await writeAuditLog(req, 'user.settings.update', { keys: Object.keys(req.body) });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.get('/storage', auth, async (req, res, next) => {
  try {
    const [photoCount, checkinCount, uploadFolderSize] = await Promise.all([
      prisma.photo.count({ where: activeWhere({ userId: req.user.id }) }),
      prisma.checkin.count({ where: activeWhere({ userId: req.user.id }) }),
      folderSize(uploadDir).catch(() => 0)
    ]);
    res.json({
      photoCount,
      checkinCount,
      estimatedStorage: formatBytes(uploadFolderSize),
      uploadFolderSize
    });
  } catch (error) {
    next(error);
  }
});

router.post('/export', auth, async (req, res, next) => {
  try {
    const [settings, checkins, photos, stats] = await Promise.all([
      ensureUserSettings(req.user.id),
      prisma.checkin.findMany({
        where: activeWhere({ userId: req.user.id }),
        include: { region: { include: { parent: true } }, photos: activePhotosInclude() },
        orderBy: { checkinDate: 'desc' }
      }),
      prisma.photo.findMany({
        where: activeWhere({ userId: req.user.id }),
        include: { checkin: { include: { region: { include: { parent: true } } } } },
        orderBy: { createdAt: 'desc' }
      }),
      buildStats(req.user.id)
    ]);
    res.json({
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      userId: req.user.id,
      profile: publicUser(req.user),
      settings,
      checkins,
      photos,
      stats
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/cache', auth, async (req, res) => {
  res.json({ message: 'Local cache cleared.' });
});

router.delete('/account', auth, sensitiveLimiter, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const { password } = req.body;
    const ok = await bcrypt.compare(password || '', req.user.passwordHash);
    if (!ok) throw new AppError(400, 'Password is incorrect.', 'INVALID_PASSWORD');

    const now = new Date();
    const photos = await prisma.photo.findMany({ where: activeWhere({ userId: req.user.id }) });
    await prisma.photo.updateMany({ where: activeWhere({ userId: req.user.id }), data: { deletedAt: now } });
    await prisma.checkin.updateMany({ where: activeWhere({ userId: req.user.id }), data: { deletedAt: now } });
    await prisma.loginSession.updateMany({ where: { userId: req.user.id, revokedAt: null }, data: { revokedAt: now } });
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        deletedAt: now,
        email: null,
        phone: null,
        username: null
      }
    });
    for (const photo of photos) {
      await deleteLocalUpload(photo.imageUrl);
    }
    await deleteLocalUpload(req.user.avatar);
    await writeAuditLog(req, 'user.account.soft_delete', { userId: req.user.id });
    res.json({ message: 'Account deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
