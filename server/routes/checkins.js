const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { uploadPhotos, uploadedPhotos, deleteLocalUpload, validateUploadedFiles } = require('../upload');
const { AppError } = require('../errors');
const { getPagination, hasPagination, paginated } = require('../pagination');
const { activeWhere, activePhotosInclude } = require('../services/content-service');

const router = express.Router();

function includeFullCheckin() {
  return {
    region: { include: { parent: true } },
    photos: activePhotosInclude()
  };
}

router.post('/', auth, uploadPhotos, async (req, res, next) => {
  const files = uploadedPhotos(req);
  try {
    const { regionId, checkinDate, note, title } = req.body;
    if (!regionId || !checkinDate) {
      throw new AppError(400, 'regionId and checkinDate are required.', 'VALIDATION_ERROR');
    }
    if (!files.length) {
      throw new AppError(400, 'Please upload at least one photo.', 'UPLOAD_REQUIRED');
    }
    await validateUploadedFiles(files);

    const region = await prisma.region.findUnique({ where: { id: regionId } });
    if (!region) throw new AppError(404, 'Region not found.', 'REGION_NOT_FOUND');

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
    if (files.length) {
      await Promise.all(files.map((file) => deleteLocalUpload(`/uploads/${file.filename}`)));
    }
    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const where = activeWhere({ userId: req.user.id });
    const pagination = getPagination(req.query);
    const [checkins, total] = await Promise.all([
      prisma.checkin.findMany({
        where,
        include: includeFullCheckin(),
        orderBy: { checkinDate: 'desc' },
        ...(hasPagination(req.query) ? { skip: pagination.skip, take: pagination.take } : {})
      }),
      hasPagination(req.query) ? prisma.checkin.count({ where }) : Promise.resolve(0)
    ]);
    res.json(hasPagination(req.query) ? paginated(checkins, total, pagination) : checkins);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const checkin = await prisma.checkin.findFirst({
      where: activeWhere({ id: req.params.id, userId: req.user.id }),
      include: includeFullCheckin()
    });
    if (!checkin) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');
    res.json(checkin);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', auth, async (req, res, next) => {
  try {
    const existing = await prisma.checkin.findFirst({ where: activeWhere({ id: req.params.id, userId: req.user.id }) });
    if (!existing) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');

    const { regionId, checkinDate, note, title } = req.body;
    if (regionId) {
      const region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) throw new AppError(404, 'Region not found.', 'REGION_NOT_FOUND');
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
      where: activeWhere({ id: req.params.id, userId: req.user.id }),
      include: { photos: activePhotosInclude() }
    });
    if (!existing) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');

    const now = new Date();
    await prisma.photo.updateMany({ where: activeWhere({ checkinId: existing.id, userId: req.user.id }), data: { deletedAt: now } });
    await prisma.checkin.update({ where: { id: existing.id }, data: { deletedAt: now } });
    for (const photo of existing.photos) {
      await deleteLocalUpload(photo.imageUrl);
    }
    res.json({ message: 'Checkin deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
