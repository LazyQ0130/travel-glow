const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');

const router = express.Router();

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function signToken(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
}

router.post('/register', async (req, res, next) => {
  try {
    const { nickname, email, password } = req.body;
    if (!nickname || !email || !password) {
      return res.status(400).json({ message: 'nickname、email、password 都不能为空' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { nickname, email, passwordHash }
    });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: '邮箱已注册' });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    const ok = await bcrypt.compare(password || '', user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
