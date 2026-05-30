const bcrypt = require('bcryptjs');
const prisma = require('./db');

const CODE_TTL_MINUTES = 5;
const SEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function normalizePhone(phone = '') {
  return String(phone).replace(/[^\d+]/g, '').trim();
}

function isValidPhone(phone) {
  return /^(\+?\d{8,15})$/.test(normalizePhone(phone));
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createSmsCode({ phone, purpose, userId = null, ipAddress = '' }) {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    const error = new Error('请输入有效手机号');
    error.statusCode = 400;
    throw error;
  }

  const recent = await prisma.verificationCode.findFirst({
    where: {
      phone: normalized,
      purpose,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - SEND_COOLDOWN_SECONDS * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (recent) {
    const error = new Error('验证码发送过于频繁，请稍后再试');
    error.statusCode = 429;
    throw error;
  }

  const code = createCode();
  await prisma.verificationCode.create({
    data: {
      phone: normalized,
      purpose,
      userId,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      ipAddress
    }
  });

  // 本地练手项目默认走开发模式：返回 devCode。接入真实短信时在这里调用服务商 SDK。
  return {
    phone: normalized,
    expiresIn: CODE_TTL_MINUTES * 60,
    devCode: process.env.SMS_PROVIDER === 'mock' || process.env.NODE_ENV !== 'production' ? code : undefined
  };
}

async function verifySmsCode({ phone, purpose, code }) {
  const normalized = normalizePhone(phone);
  const record = await prisma.verificationCode.findFirst({
    where: {
      phone: normalized,
      purpose,
      consumedAt: null
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!record || record.expiresAt < new Date()) {
    const error = new Error('验证码不存在或已过期');
    error.statusCode = 400;
    throw error;
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    const error = new Error('验证码尝试次数过多，请重新获取');
    error.statusCode = 400;
    throw error;
  }

  const ok = await bcrypt.compare(String(code || ''), record.codeHash);
  if (!ok) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } }
    });
    const error = new Error('验证码错误');
    error.statusCode = 400;
    throw error;
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() }
  });
  return normalized;
}

module.exports = { normalizePhone, isValidPhone, createSmsCode, verifySmsCode };
