const prisma = require('./db');
const { maskEmail, maskPhone } = require('./utils/mask');

function publicUser(user) {
  const { passwordHash, failedLoginCount, lastFailedLoginAt, lockedUntil, deletedAt, ...safeUser } = user;
  return {
    ...safeUser,
    phone: maskPhone(safeUser.phone),
    email: maskEmail(safeUser.email)
  };
}

async function ensureUserSettings(userId) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
}

function sessionMeta(req) {
  const userAgent = req.headers['user-agent'] || '';
  return {
    userAgent,
    ipAddress: req.ip || req.socket?.remoteAddress || '',
    deviceName: userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser'
  };
}

module.exports = { publicUser, ensureUserSettings, sessionMeta };
