const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const rateLimit = require('../middleware/rate-limit');
const { writeAuditLog } = require('../audit');
const { publicUser, ensureUserSettings, sessionMeta } = require('../user-utils');
const { normalizePhone, createSmsCode, verifySmsCode } = require('../sms');
const { config } = require('../config');
const { AppError } = require('../errors');
const { passwordIssues } = require('../security/password-policy');
const { assertNotLocked, recordFailedLogin, clearFailedLogins } = require('../services/auth-service');

const router = express.Router();

const usernameSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/);
const passwordSchema = z.string().min(1).max(72);
const optionalEmailSchema = z.union([z.literal(''), z.string().trim().email()]).optional();

const sendSmsSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  purpose: z.enum(['register', 'login', 'bind_phone']).default('login')
});

const registerSchema = z.object({
  username: usernameSchema,
  nickname: z.string().trim().min(1).max(30),
  email: optionalEmailSchema,
  phone: z.string().trim().min(8).max(20),
  password: passwordSchema,
  code: z.string().trim().length(6)
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1)
}).refine((data) => data.identifier || data.email, { message: 'Identifier or email is required.' });

const phoneLoginSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().length(6)
});

function signToken(user, session) {
  return jwt.sign({ userId: user.id, sessionId: session.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function createSession(req, userId) {
  return prisma.loginSession.create({
    data: {
      userId,
      ...sessionMeta(req)
    }
  });
}

function normalizeUsername(username = '') {
  return String(username).trim().toLowerCase();
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

async function findUserByIdentifier(identifier = '') {
  const value = String(identifier).trim();
  const normalizedPhone = normalizePhone(value);
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { username: normalizeUsername(value) },
        { email: normalizeEmail(value) },
        { phone: normalizedPhone }
      ]
    }
  });
}

function assertStrongPassword(password) {
  const issues = passwordIssues(password);
  if (issues.length) {
    throw new AppError(400, 'Password does not meet strength requirements.', 'WEAK_PASSWORD', issues);
  }
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const smsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'sms' });

router.post('/sms/send', smsLimiter, validate(sendSmsSchema), async (req, res, next) => {
  try {
    const { phone, purpose = 'login' } = req.body;
    const result = await createSmsCode({
      phone,
      purpose,
      ipAddress: req.ip || req.socket?.remoteAddress || ''
    });
    res.json({ message: 'Verification code sent.', ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, nickname, email, phone, password, code } = req.body;
    assertStrongPassword(password);

    const cleanUsername = normalizeUsername(username);
    const cleanEmail = email ? normalizeEmail(email) : null;
    const cleanPhone = await verifySmsCode({ phone, purpose: 'register', code });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        nickname,
        email: cleanEmail,
        phone: cleanPhone,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: cleanEmail ? new Date() : null,
        passwordHash,
        settings: { create: {} }
      },
      include: { settings: true }
    });
    const session = await createSession(req, user.id);
    await writeAuditLog(req, 'auth.register', { userId: user.id, username: user.username });

    res.json({ token: signToken(user, session), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body;
    const user = await findUserByIdentifier(identifier || email);
    if (!user) {
      throw new AppError(401, 'Invalid account or password.', 'INVALID_CREDENTIALS');
    }

    assertNotLocked(user);
    const ok = await bcrypt.compare(password || '', user.passwordHash);
    if (!ok) {
      await recordFailedLogin(user);
      throw new AppError(401, 'Invalid account or password.', 'INVALID_CREDENTIALS');
    }

    await clearFailedLogins(user.id);
    await ensureUserSettings(user.id);
    const session = await createSession(req, user.id);
    await writeAuditLog(req, 'auth.login', { userId: user.id, method: 'password' });

    res.json({ token: signToken(user, session), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login/phone', authLimiter, validate(phoneLoginSchema), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const cleanPhone = await verifySmsCode({ phone, purpose: 'login', code });
    const user = await prisma.user.findFirst({ where: { phone: cleanPhone, deletedAt: null } });
    if (!user) throw new AppError(401, 'Phone number is not registered.', 'PHONE_NOT_REGISTERED');

    assertNotLocked(user);
    await clearFailedLogins(user.id);
    await ensureUserSettings(user.id);
    const session = await createSession(req, user.id);
    await writeAuditLog(req, 'auth.login', { userId: user.id, method: 'phone' });
    res.json({ token: signToken(user, session), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', auth, async (req, res, next) => {
  try {
    await prisma.loginSession.update({
      where: { id: req.session.id },
      data: { revokedAt: new Date() }
    });
    await writeAuditLog(req, 'auth.logout', { sessionId: req.session.id });
    res.json({ message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const settings = await ensureUserSettings(req.user.id);
    const sessions = await prisma.loginSession.findMany({
      where: { userId: req.user.id, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
      take: 5
    });
    res.json({ user: publicUser(req.user), settings, sessions });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/others', auth, async (req, res, next) => {
  try {
    const result = await prisma.loginSession.updateMany({
      where: {
        userId: req.user.id,
        id: { not: req.session.id },
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
    await writeAuditLog(req, 'auth.session.revoke_others', { count: result.count });
    res.json({ message: 'Other sessions revoked.', count: result.count });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', auth, async (req, res, next) => {
  try {
    const session = await prisma.loginSession.findFirst({
      where: { id: req.params.id, userId: req.user.id, revokedAt: null }
    });
    if (!session) throw new AppError(404, 'Session not found.', 'SESSION_NOT_FOUND');
    await prisma.loginSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });
    await writeAuditLog(req, 'auth.session.revoke', { sessionId: session.id });
    res.json({ message: 'Session revoked.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
