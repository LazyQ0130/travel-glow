const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { uploadPhotos, uploadedPhotos, deleteLocalUpload } = require('../upload');

const router = express.Router();

function includeFullCheckin() {
  return {
    region: { include: { parent: true } },
    photos: true
  };
}

router.post('/', auth, uploadPhotos, async (req, res, next) => {
  const files = uploadedPhotos(req);
  try {
    const { regionId, checkinDate, note, title } = req.body;
    if (!regionId || !checkinDate) {
      return res.status(400).json({ message: 'regionId 和 checkinDate 不能为空' });
    }
    if (!files.length) {
      return res.status(400).json({ message: '请至少上传 1 张照片' });
    }

    const region = await prisma.region.findUnique({ where: { id: regionId } });
    if (!region) return res.status(404).json({ message: '地区不存在' });

    const checkin = await prisma.checkin.create({
      data: {
        userId: req.user.id,
        regionId,
        checkinDate: new Date(checkinDate),
        note: note || null,
        title: title || null,
        photos: {
          create: files.map((file) => ({
            userId: req.user.id,
            imageUrl: `/uploads/${file.filename}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          }))
        }
      },
      include: includeFullCheckin()
    });

    res.status(201).json(checkin);
  } catch (error) {
    if (req.files) {
      await Promise.all(files.map((file) => deleteLocalUpload(`/uploads/${file.filename}`)));
    }
    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const checkins = await prisma.checkin.findMany({
      where: { userId: req.user.id },
      include: includeFullCheckin(),
      orderBy: { checkinDate: 'desc' }
    });
    res.json(checkins);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const checkin = await prisma.checkin.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: includeFullCheckin()
    });
    if (!checkin) return res.status(404).json({ message: '打卡不存在' });
    res.json(checkin);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', auth, async (req, res, next) => {
  try {
    const existing = await prisma.checkin.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ message: '打卡不存在' });

    const { regionId, checkinDate, note, title } = req.body;
    if (regionId) {
      const region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) return res.status(404).json({ message: '地区不存在' });
    }

    const checkin = await prisma.checkin.update({
      where: { id: existing.id },
      data: {
        ...(regionId !== undefined ? { regionId } : {}),
        ...(checkinDate !== undefined ? { checkinDate: new Date(checkinDate) } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(title !== undefined ? { title } : {})
      },
      include: includeFullCheckin()
    });
    res.json(checkin);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const existing = await prisma.checkin.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { photos: true }
    });
    if (!existing) return res.status(404).json({ message: '打卡不存在' });

    await prisma.photo.deleteMany({ where: { checkinId: existing.id, userId: req.user.id } });
    await prisma.checkin.delete({ where: { id: existing.id } });
    for (const photo of existing.photos) {
      await deleteLocalUpload(photo.imageUrl);
    }
    res.json({ message: '已删除打卡' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
