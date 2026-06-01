const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadPhotos, uploadedPhotos, deleteLocalUpload, validateUploadedFiles } = require('../upload');
const { AppError } = require('../errors');
const { getPagination, hasPagination } = require('../pagination');
const { activeWhere } = require('../services/content-service');

const router = express.Router();

const createCheckinSchema = z.object({
  regionId: z.string({ message: 'regionId is required.' }).trim().min(1, 'regionId is required.'),
  checkinDate: z.iso.date({ message: 'checkinDate must be an ISO date in YYYY-MM-DD format.' }),
  note: z.string().max(500, 'note must be 500 characters or fewer.').optional(),
  title: z.string().max(100, 'title must be 100 characters or fewer.').optional()
});

const updateCheckinSchema = z.object({
  regionId: z.string().trim().min(1, 'regionId is required.').optional(),
  checkinDate: z.iso.date({ message: 'checkinDate must be an ISO date in YYYY-MM-DD format.' }).optional(),
  note: z.union([z.string().max(500, 'note must be 500 characters or fewer.'), z.null()]).optional(),
  title: z.union([z.string().max(100, 'title must be 100 characters or fewer.'), z.null()]).optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required.'
});

const checkinPhotosSchema = z.object({
  photos: z.array(z.any())
    .min(1, 'Please upload at least one photo.')
    .max(9, 'Please upload no more than 9 photos.')
});

function selectRegionSummary() {
  return {
    id: true,
    name: true,
    shortName: true,
    type: true,
    parentId: true,
    code: true,
    regionType: true,
    totalCities: true,
    sortOrder: true
  };
}

function selectPhotoSummary() {
  return {
    id: true,
    imageUrl: true,
    originalName: true,
    mimeType: true,
    size: true,
    createdAt: true
  };
}

function selectFullCheckin() {
  return {
    id: true,
    userId: true,
    regionId: true,
    checkinDate: true,
    note: true,
    title: true,
    createdAt: true,
    updatedAt: true,
    region: {
      select: {
        ...selectRegionSummary(),
        parent: { select: selectRegionSummary() }
      }
    },
    photos: {
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: selectPhotoSummary()
    }
  };
}

function getCursorPagination(query = {}) {
  const pagination = getPagination(query);
  const cursor = typeof query.cursor === 'string' && query.cursor.trim() ? query.cursor.trim() : null;
  return {
    limit: pagination.pageSize,
    cursor,
    cursorValues: cursor ? decodeCursor(cursor) : null,
    legacyPage: pagination.page
  };
}

function encodeCursor(checkin) {
  return Buffer.from(JSON.stringify({
    checkinDate: checkin.checkinDate.toISOString(),
    id: checkin.id
  })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const checkinDate = new Date(decoded.checkinDate);
    if (!decoded.id || Number.isNaN(checkinDate.getTime())) {
      throw new Error('Invalid cursor payload.');
    }
    return { checkinDate, id: decoded.id };
  } catch (error) {
    throw new AppError(400, 'Invalid pagination cursor.', 'INVALID_CURSOR');
  }
}

function cursorWhere(cursorValues) {
  if (!cursorValues) return {};
  return {
    OR: [
      { checkinDate: { lt: cursorValues.checkinDate } },
      { checkinDate: cursorValues.checkinDate, id: { lt: cursorValues.id } }
    ]
  };
}

function cursorPaginated(rows, pagination) {
  const hasNextPage = rows.length > pagination.limit;
  const data = hasNextPage ? rows.slice(0, pagination.limit) : rows;
  const nextCursor = hasNextPage ? encodeCursor(data[data.length - 1]) : null;

  return {
    data,
    pagination: {
      pageSize: pagination.limit,
      nextCursor,
      hasNextPage,
      hasPreviousPage: Boolean(pagination.cursor),
      cursor: pagination.cursor,
      page: pagination.legacyPage,
      total: null,
      totalPages: null
    }
  };
}

function validateCheckinPhotos(req, res, next) {
  const result = checkinPhotosSchema.safeParse({ photos: uploadedPhotos(req) });
  if (!result.success) {
    return res.status(400).json({
      message: 'Request validation failed.',
      code: 'VALIDATION_ERROR',
      details: result.error.flatten()
    });
  }
  req.checkinPhotos = result.data.photos;
  next();
}

router.post('/', auth, uploadPhotos, validate(createCheckinSchema), validateCheckinPhotos, async (req, res, next) => {
  const files = req.checkinPhotos;
  try {
    const { regionId, checkinDate, note, title } = req.body;
    await validateUploadedFiles(files);

    const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
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
      select: selectFullCheckin()
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
    if (hasPagination(req.query) || req.query.cursor !== undefined) {
      const pagination = getCursorPagination(req.query);
      const checkins = await prisma.checkin.findMany({
        where: { ...where, ...cursorWhere(pagination.cursorValues) },
        select: selectFullCheckin(),
        orderBy: [{ checkinDate: 'desc' }, { id: 'desc' }],
        take: pagination.limit + 1
      });
      return res.json(cursorPaginated(checkins, pagination));
    }

    const checkins = await prisma.checkin.findMany({
      where,
      select: selectFullCheckin(),
      orderBy: [{ checkinDate: 'desc' }, { id: 'desc' }]
    });
    res.json(checkins);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const checkin = await prisma.checkin.findFirst({
      where: activeWhere({ id: req.params.id, userId: req.user.id }),
      select: selectFullCheckin()
    });
    if (!checkin) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');
    res.json(checkin);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', auth, validate(updateCheckinSchema), async (req, res, next) => {
  try {
    const existing = await prisma.checkin.findFirst({
      where: activeWhere({ id: req.params.id, userId: req.user.id }),
      select: { id: true }
    });
    if (!existing) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');

    const { regionId, checkinDate, note, title } = req.body;
    if (regionId) {
      const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
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
      select: selectFullCheckin()
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
      select: {
        id: true,
        photos: {
          where: { deletedAt: null },
          select: { imageUrl: true }
        }
      }
    });
    if (!existing) throw new AppError(404, 'Checkin not found.', 'CHECKIN_NOT_FOUND');

    const now = new Date();
    await prisma.$transaction([
      prisma.photo.updateMany({ where: activeWhere({ checkinId: existing.id, userId: req.user.id }), data: { deletedAt: now } }),
      prisma.checkin.update({ where: { id: existing.id }, data: { deletedAt: now } })
    ]);
    for (const photo of existing.photos) {
      await deleteLocalUpload(photo.imageUrl);
    }
    res.json({ message: 'Checkin deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
