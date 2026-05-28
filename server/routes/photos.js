const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { uploadPhotos, uploadedPhotos, deleteLocalUpload } = require('../upload');

const router = express.Router();

function includePhoto() {
  return {
    checkin: {
      include: {
        region: { include: { parent: true } }
      }
    }
  };
}

router.post('/upload', auth, uploadPhotos, async (req, res, next) => {
  const files = uploadedPhotos(req);
  try {
    const { checkinId } = req.body;
    const checkin = await prisma.checkin.findFirst({ where: { id: checkinId, userId: req.user.id } });
    if (!checkin) return res.status(404).json({ message: '打卡不存在' });
    if (!files.length) return res.status(400).json({ message: '请至少上传 1 张照片' });

    await prisma.photo.createMany({
      data: files.map((file) => ({
        userId: req.user.id,
        checkinId,
        imageUrl: `/uploads/${file.filename}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      }))
    });

    const photos = await prisma.photo.findMany({
      where: { checkinId, userId: req.user.id },
      include: includePhoto(),
      orderBy: { createdAt: 'desc' }
    });
    res.status(201).json(photos);
  } catch (error) {
    if (req.files) {
      await Promise.all(files.map((file) => deleteLocalUpload(`/uploads/${file.filename}`)));
    }
    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const photos = await prisma.photo.findMany({
      where: { userId: req.user.id },
      include: includePhoto(),
      orderBy: { createdAt: 'desc' }
    });
    res.json(photos.map((photo) => ({
      id: photo.id,
      imageUrl: photo.imageUrl,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      size: photo.size,
      createdAt: photo.createdAt,
      checkin: photo.checkin,
      region: photo.checkin.region,
      parentRegion: photo.checkin.region.parent,
      date: photo.checkin.checkinDate,
      note: photo.checkin.note
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: includePhoto()
    });
    if (!photo) return res.status(404).json({ message: '照片不存在' });
    res.json(photo);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const photo = await prisma.photo.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!photo) return res.status(404).json({ message: '照片不存在' });
    await prisma.photo.delete({ where: { id: photo.id } });
    await deleteLocalUpload(photo.imageUrl);
    res.json({ message: '已删除照片' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
