const bcrypt = require('bcryptjs');
const prisma = require('./db');
const { config } = require('./config');
const { AppError } = require('./errors');
const { logger } = require('./logger');
const smtpProvider = require('./email-providers/smtp');

const CODE_TTL_MINUTES = 5;
const SEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const NON_DELIVERABLE_TLDS = new Set(['local', 'localhost', 'invalid', 'test']);

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  if (!/^[\x21-\x7e]+$/.test(normalized)) return false;

  const parts = normalized.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;
  if (!localPart || !domain || localPart.length > 64 || domain.length > 253) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9-]+$/.test(label)) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }

  const tld = labels[labels.length - 1];
  // `.local`, `.test`, and similar internal-only domains can pass loose email
  // regexes but cannot receive public SMTP mail, which caused the bounce.
  if (NON_DELIVERABLE_TLDS.has(tld)) return false;
  if (!/^[a-z]{2,63}$/.test(tld)) return false;

  return true;
}

function assertValidEmail(email) {
  if (!isValidEmail(email)) {
    throw new AppError(400, 'Please enter a valid, publicly deliverable email address.', 'INVALID_EMAIL');
  }
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailCode({ email, code, purpose }) {
  const normalized = normalizeEmail(email);
  assertValidEmail(normalized);

  logger.info(
    { to: normalized, purpose, provider: config.emailProvider },
    'Sending email verification code.'
  );

  if (config.emailProvider === 'mock') {
    return { provider: 'mock' };
  }

  try {
    await smtpProvider.sendMail({
      to: normalized,
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
  assertValidEmail(normalized);

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
    devCode: config.exposeDevEmailCode && !config.isProduction ? code : undefined
  };
}

async function verifyEmailCode({ email, purpose, code }) {
  const normalized = normalizeEmail(email);
  assertValidEmail(normalized);
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

module.exports = { normalizeEmail, isValidEmail, assertValidEmail, createEmailCode, verifyEmailCode, sendEmailCode };
