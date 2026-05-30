const prisma = require('./db');

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
    console.warn(`Audit log failed: ${action}`, error.message);
  }
}

module.exports = { writeAuditLog };
