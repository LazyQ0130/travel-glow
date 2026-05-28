const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

router.get('/profile', auth, async (req, res) => {
  res.json(publicUser(req.user));
});

router.put('/profile', auth, async (req, res, next) => {
  try {
    const { nickname, bio, avatar } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(nickname !== undefined ? { nickname } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatar !== undefined ? { avatar } : {})
      }
    });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
