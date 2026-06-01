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
const { createEmailCode, verifyEmailCode, normalizeEmail, isValidEmail } = require('../email-verification');
const { config } = require('../config');
const { AppError } = require('../errors');
const { passwordIssues } = require('../security/password-policy');
const { assertNotLocked, recordFailedLogin, clearFailedLogins } = require('../services/auth-service');

const router = express.Router();

const usernameSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/);
const passwordSchema = z.string().min(1).max(72);
const emailAddressSchema = z.string()
  .trim()
  .transform(normalizeEmail)
  .refine(isValidEmail, { message: 'Please enter a valid, publicly deliverable email address.' });

const sendEmailSchema = z.object({
  email: emailAddressSchema,
  purpose: z.enum(['register', 'login']).default('login')
});

const registerSchema = z.object({
  username: usernameSchema,
  nickname: z.string().trim().min(1).max(30),
  email: emailAddressSchema,
  password: passwordSchema,
  code: z.string().trim().length(6)
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1)
}).refine((data) => data.identifier || data.email, { message: 'Identifier or email is required.' });

const emailLoginSchema = z.object({
  email: emailAddressSchema,
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

async function findUserByIdentifier(identifier = '') {
  const value = String(identifier).trim();
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { username: normalizeUsername(value) },
        { email: normalizeEmail(value) }
      ]
    }
  });
}

async function findActiveUserByEmail(email = '') {
  return prisma.user.findFirst({
    where: {
      email: normalizeEmail(email),
      deletedAt: null
    }
  });
}

async function assertEmailAvailable(email) {
  const existing = await findActiveUserByEmail(email);
  if (existing) throw new AppError(409, 'Email is already in use.', 'EMAIL_IN_USE');
}

function assertStrongPassword(password) {
  const issues = passwordIssues(password);
  if (issues.length) {
    throw new AppError(400, 'Password does not meet strength requirements.', 'WEAK_PASSWORD', issues);
  }
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyPrefix: 'auth' });
const emailCodeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'email-code' });

function formatSession(session, currentSessionId) {
  return {
    id: session.id,
    deviceName: session.deviceName,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    lastActiveAt: session.lastActiveAt,
    createdAt: session.createdAt,
    isCurrent: session.id === currentSessionId
  };
}

router.post('/email/send', emailCodeLimiter, validate(sendEmailSchema), async (req, res, next) => {
  try {
    const { email, purpose = 'login' } = req.body;
    const cleanEmail = normalizeEmail(email);
    const user = await findActiveUserByEmail(cleanEmail);

    if (purpose === 'register') {
      if (user) throw new AppError(409, 'Email is already in use.', 'EMAIL_IN_USE');
    } else if (!user) {
      throw new AppError(401, 'Email is not registered.', 'EMAIL_NOT_REGISTERED');
    }

    const result = await createEmailCode({
      email: cleanEmail,
      purpose,
      userId: user?.id || null,
      ipAddress: req.ip || req.socket?.remoteAddress || ''
    });
    res.json({ message: 'Verification code sent.', ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, nickname, email, password, code } = req.body;
    assertStrongPassword(password);

    const cleanUsername = normalizeUsername(username);
    const cleanEmail = normalizeEmail(email);
    await assertEmailAvailable(cleanEmail);
    await verifyEmailCode({ email: cleanEmail, purpose: 'register', code });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        nickname,
        email: cleanEmail,
        emailVerifiedAt: new Date(),
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

router.post('/login/email', authLimiter, validate(emailLoginSchema), async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = await verifyEmailCode({ email, purpose: 'login', code });
    const user = await findActiveUserByEmail(cleanEmail);
    if (!user) throw new AppError(401, 'Email is not registered.', 'EMAIL_NOT_REGISTERED');

    assertNotLocked(user);
    await clearFailedLogins(user.id);
    await ensureUserSettings(user.id);
    const session = await createSession(req, user.id);
    await writeAuditLog(req, 'auth.login', { userId: user.id, method: 'email_code' });
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
    res.json({ user: publicUser(req.user), settings, sessions: sessions.map((session) => formatSession(session, req.session.id)) });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', auth, async (req, res, next) => {
  try {
    const sessions = await prisma.loginSession.findMany({
      where: { userId: req.user.id, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' }
    });
    res.json({ sessions: sessions.map((session) => formatSession(session, req.session.id)) });
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
