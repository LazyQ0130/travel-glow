const bcrypt = require('bcryptjs');
const prisma = require('./db');
const { config } = require('./config');
const { AppError } = require('./errors');
const smtpProvider = require('./email-providers/smtp');

const CODE_TTL_MINUTES = 5;
const SEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailCode({ email, code, purpose }) {
  if (config.emailProvider === 'mock') {
    return { provider: 'mock' };
  }

  try {
    await smtpProvider.sendMail({
      to: email,
      subject: 'Travel Glow verification code',
      text: [
        `Your Travel Glow verification code is: ${code}`,
        '',
        `Purpose: ${purpose}`,
        `This code expires in ${CODE_TTL_MINUTES} minutes.`,
        '',
        'If you did not request this code, you can ignore this email.'
      ].join('\n'),
      config: config.smtp
    });
    return { provider: 'smtp' };
  } catch (error) {
    throw new AppError(
      502,
      'Failed to send verification email.',
      'EMAIL_SEND_FAILED',
      config.isProduction ? undefined : error.message
    );
  }
}

async function createEmailCode({ email, purpose, userId = null, ipAddress = '' }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new AppError(400, 'Please enter a valid email address.', 'INVALID_EMAIL');
  }

  const recent = await prisma.emailVerificationCode.findFirst({
    where: {
      email: normalized,
      purpose,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - SEND_COOLDOWN_SECONDS * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (recent) {
    throw new AppError(429, 'Verification code was requested too recently.', 'EMAIL_CODE_RATE_LIMITED');
  }

  const code = createCode();
  await prisma.emailVerificationCode.create({
    data: {
      email: normalized,
      purpose,
      userId,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
      ipAddress
    }
  });
  await sendEmailCode({ email: normalized, code, purpose });

  return {
    email: normalized,
    expiresIn: CODE_TTL_MINUTES * 60,
    devCode: config.emailProvider === 'mock' || !config.isProduction ? code : undefined
  };
}

async function verifyEmailCode({ email, purpose, code }) {
  const normalized = normalizeEmail(email);
  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      email: normalized,
      purpose,
      consumedAt: null
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Verification code does not exist or has expired.', 'EMAIL_CODE_EXPIRED');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new AppError(400, 'Too many verification attempts. Request a new code.', 'EMAIL_CODE_LOCKED');
  }

  const ok = await bcrypt.compare(String(code || ''), record.codeHash);
  if (!ok) {
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } }
    });
    throw new AppError(400, 'Verification code is incorrect.', 'EMAIL_CODE_INVALID');
  }

  await prisma.emailVerificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() }
  });
  return normalized;
}

module.exports = { normalizeEmail, isValidEmail, createEmailCode, verifyEmailCode, sendEmailCode };
