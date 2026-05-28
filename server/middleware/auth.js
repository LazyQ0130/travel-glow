const jwt = require('jsonwebtoken');
const prisma = require('../db');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: '请先登录' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ message: '登录状态已失效' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: '登录状态已失效' });
  }
}

module.exports = auth;
