const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { uploadPhotos, uploadedPhotos, deleteLocalUpload, validateUploadedFiles } = require('../upload');
const { AppError } = require('../errors');
const { getPagination, hasPagination, paginated } = require('../pagination');
const { activeWhere } = require('../services/content-service');

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

function photoResponse(photo) {
  return {
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
  };
}

router.post('/upload', auth, uploadPhotos, async (req, res, next) => {
  const files = uploadedPhotos(req);
  try {
    const { checkinId } = req.body;
    const checkin = await prisma.checkin.findFirst({ where: activeWhere({ id: checkinId, userId: req.user.id }) });
    if (!checkin) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');
    if (!files.length) throw new AppError(400, 'Please upload at least one photo.', 'UPLOAD_REQUIRED');
    await validateUploadedFiles(files);

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
      where: activeWhere({ checkinId, userId: req.user.id }),
      include: includePhoto(),
      orderBy: { createdAt: 'desc' }
    });
    res.status(201).json(photos);
  } catch (error) {
    if (files.length) {
      await Promise.all(files.map((file) => deleteLocalUpload(`/uploads/${file.filename}`)));
    }
    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const where = activeWhere({ userId: req.user.id, checkin: { deletedAt: null } });
    const pagination = getPagination(req.query);
    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        include: includePhoto(),
        orderBy: { createdAt: 'desc' },
        ...(hasPagination(req.query) ? { skip: pagination.skip, take: pagination.take } : {})
      }),
      hasPagination(req.query) ? prisma.photo.count({ where }) : Promise.resolve(0)
    ]);
    const data = photos.map(photoResponse);
    res.json(hasPagination(req.query) ? paginated(data, total, pagination) : data);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: activeWhere({ id: req.params.id, userId: req.user.id }),
      include: includePhoto()
    });
    if (!photo || photo.checkin.deletedAt) throw new AppError(404, 'Photo not found.', 'PHOTO_NOT_FOUND');
    res.json(photo);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const photo = await prisma.photo.findFirst({ where: activeWhere({ id: req.params.id, userId: req.user.id }) });
    if (!photo) throw new AppError(404, 'Photo not found.', 'PHOTO_NOT_FOUND');
    await prisma.photo.update({ where: { id: photo.id }, data: { deletedAt: new Date() } });
    await deleteLocalUpload(photo.imageUrl);
    res.json({ message: 'Photo deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
