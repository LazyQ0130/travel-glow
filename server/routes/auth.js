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

const router = express.Router();

const usernameSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/);
const passwordSchema = z.string().min(6).max(72);
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
}).refine((data) => data.identifier || data.email, { message: '请输入账号名、手机号或邮箱' });

const phoneLoginSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  code: z.string().trim().length(6)
});

function signToken(user, session) {
  return jwt.sign({ userId: user.id, sessionId: session.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
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
      OR: [
        { username: normalizeUsername(value) },
        { email: normalizeEmail(value) },
        { phone: normalizedPhone }
      ]
    }
  });
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const smsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'sms' });

router.post('/sms/send', smsLimiter, validate(sendSmsSchema), async (req, res, next) => {
  try {
    const { phone, purpose = 'login' } = req.body;
    if (!['register', 'login', 'bind_phone'].includes(purpose)) {
      return res.status(400).json({ message: '验证码用途不正确' });
    }
    const result = await createSmsCode({
      phone,
      purpose,
      ipAddress: req.ip || req.socket?.remoteAddress || ''
    });
    res.json({ message: '验证码已发送', ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, nickname, email, phone, password, code } = req.body;
    if (!username || !nickname || !phone || !password || !code) {
      return res.status(400).json({ message: '账号名、昵称、手机号、密码、验证码都不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: '密码至少 6 位' });
    }
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
    if (error.code === 'P2002') {
      return res.status(409).json({ message: '账号名、邮箱或手机号已被使用' });
    }
    next(error);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body;
    const user = await findUserByIdentifier(identifier || email);
    if (!user) {
      return res.status(401).json({ message: '账号或密码错误', code: 'INVALID_CREDENTIALS' });
    }

    const ok = await bcrypt.compare(password || '', user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: '账号或密码错误', code: 'INVALID_CREDENTIALS' });
    }
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
    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (!user) return res.status(401).json({ message: '手机号未注册' });
    await ensureUserSettings(user.id);
    const session = await createSession(req, user.id);
    await writeAuditLog(req, 'auth.login', { userId: user.id, method: 'phone' });
    res.json({ token: signToken(user, session), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', auth, async (req, res) => {
  await prisma.loginSession.update({
    where: { id: req.session.id },
    data: { revokedAt: new Date() }
  });
  await writeAuditLog(req, 'auth.logout', { sessionId: req.session.id });
  res.json({ message: '已退出登录' });
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
    res.json({ message: '其他设备已退出登录', count: result.count });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', auth, async (req, res, next) => {
  try {
    const session = await prisma.loginSession.findFirst({
      where: { id: req.params.id, userId: req.user.id, revokedAt: null }
    });
    if (!session) return res.status(404).json({ message: '登录设备不存在', code: 'SESSION_NOT_FOUND' });
    await prisma.loginSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });
    await writeAuditLog(req, 'auth.session.revoke', { sessionId: session.id });
    res.json({ message: '设备已退出登录' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
