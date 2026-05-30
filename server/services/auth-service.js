const prisma = require('../db');
const { AppError } = require('../errors');

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

function assertNotLocked(user) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, 'Account is temporarily locked. Try again later.', 'ACCOUNT_LOCKED', {
      lockedUntil: user.lockedUntil
    });
  }
}

async function recordFailedLogin(user) {
  const failedLoginCount = (user.failedLoginCount || 0) + 1;
  const data = {
    failedLoginCount,
    lastFailedLoginAt: new Date()
  };

  if (failedLoginCount >= MAX_FAILED_LOGINS) {
    data.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  }

  await prisma.user.update({
    where: { id: user.id },
    data
  });
}

async function clearFailedLogins(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null
    }
  });
}

module.exports = { assertNotLocked, recordFailedLogin, clearFailedLogins };
