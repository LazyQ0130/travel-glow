const prisma = require('./db');
const { logger } = require('./logger');

async function writeAuditLog(req, action, metadata = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || metadata.userId || null,
        action,
        ipAddress: req.ip || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
        metadata: JSON.stringify(metadata)
      }
    });
  } catch (error) {
    logger.warn({ err: error, action }, 'Audit log failed.');
  }
}

module.exports = { writeAuditLog };
