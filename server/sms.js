const bcrypt = require('bcryptjs');
const prisma = require('./db');
const { config } = require('./config');
const { AppError } = require('./errors');
const aliyunProvider = require('./sms-providers/aliyun');
const tencentProvider = require('./sms-providers/tencent');

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

function getProvider() {
  if (config.sms.provider === 'aliyun') return aliyunProvider;
  if (config.sms.provider === 'tencent') return tencentProvider;
  return {
    async sendVerificationCode() {
      return { provider: 'mock' };
    }
  };
}

async function sendVerificationCode({ phone, code, purpose }) {
  try {
    return await getProvider().sendVerificationCode({
      phone,
      code,
      purpose,
      config: config.sms
    });
  } catch (error) {
    throw new AppError(
      502,
      'Failed to send verification code.',
      'SMS_SEND_FAILED',
      config.isProduction ? undefined : error.message
    );
  }
}

async function createSmsCode({ phone, purpose, userId = null, ipAddress = '' }) {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    throw new AppError(400, 'Please enter a valid phone number.', 'INVALID_PHONE');
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
    throw new AppError(429, 'Verification code was requested too recently.', 'SMS_RATE_LIMITED');
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
  await sendVerificationCode({ phone: normalized, code, purpose });

  return {
    phone: normalized,
    expiresIn: CODE_TTL_MINUTES * 60,
    devCode: config.smsProvider === 'mock' || !config.isProduction ? code : undefined
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
    throw new AppError(400, 'Verification code does not exist or has expired.', 'SMS_CODE_EXPIRED');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new AppError(400, 'Too many verification attempts. Request a new code.', 'SMS_CODE_LOCKED');
  }

  const ok = await bcrypt.compare(String(code || ''), record.codeHash);
  if (!ok) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } }
    });
    throw new AppError(400, 'Verification code is incorrect.', 'SMS_CODE_INVALID');
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() }
  });
  return normalized;
}

module.exports = { normalizePhone, isValidPhone, createSmsCode, verifySmsCode };
