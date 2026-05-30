const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { config } = require('../config');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: '请先登录' });
    }

    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload.sessionId) {
      return res.status(401).json({ message: '登录状态已失效', code: 'SESSION_REQUIRED' });
    }
    const session = await prisma.loginSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        revokedAt: null
      }
    });
    if (!session) {
      return res.status(401).json({ message: '登录状态已失效', code: 'SESSION_REVOKED' });
    }
    const user = await prisma.user.findFirst({ where: { id: payload.userId, deletedAt: null } });
    if (!user) {
      return res.status(401).json({ message: '登录状态已失效' });
    }

    await prisma.loginSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() }
    });
    req.session = session;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: '登录状态已失效' });
  }
}

module.exports = auth;
