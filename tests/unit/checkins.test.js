const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const request = require('supertest');

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const { errorHandler } = require('../../server/errors');

const routePath = path.resolve(__dirname, '../../server/routes/checkins.js');
const dbPath = require.resolve('../../server/db');
const authPath = require.resolve('../../server/middleware/auth');
const uploadPath = require.resolve('../../server/upload');

const state = {
  regions: new Set(),
  checkins: [],
  deletedUploads: [],
  createArgs: null,
  updateArgs: null,
  failUploadValidation: false
};

function fullCheckin(overrides = {}) {
  return {
    id: overrides.id || 'checkin_1',
    userId: overrides.userId || 'user_1',
    regionId: overrides.regionId || 'region_1',
    checkinDate: overrides.checkinDate || new Date('2026-05-30T00:00:00.000Z'),
    note: overrides.note ?? null,
    title: overrides.title ?? 'Checkin',
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt || new Date('2026-05-30T01:00:00.000Z'),
    updatedAt: overrides.updatedAt || new Date('2026-05-30T01:00:00.000Z'),
    region: overrides.region || {
      id: overrides.regionId || 'region_1',
      name: 'Unit Region',
      shortName: null,
      type: 'city',
      parentId: null,
      code: null,
      regionType: null,
      totalCities: null,
      sortOrder: 0,
      parent: null
    },
    photos: overrides.photos || []
  };
}

function resetState() {
  state.regions = new Set(['region_1', 'region_2']);
  state.checkins = [
    fullCheckin({
      id: 'checkin_1',
      title: 'First',
      checkinDate: new Date('2026-05-31T00:00:00.000Z'),
      photos: [{ id: 'photo_1', imageUrl: '/uploads/unit-1.jpg' }]
    }),
    fullCheckin({
      id: 'checkin_2',
      title: 'Second',
      checkinDate: new Date('2026-05-30T00:00:00.000Z')
    })
  ];
  state.deletedUploads = [];
  state.createArgs = null;
  state.updateArgs = null;
  state.failUploadValidation = false;
}

function activeRows() {
  return state.checkins
    .filter((checkin) => checkin.userId === 'user_1' && checkin.deletedAt === null)
    .sort((left, right) => right.checkinDate - left.checkinDate || right.id.localeCompare(left.id));
}

const prismaMock = {
  region: {
    findUnique: async ({ where }) => (state.regions.has(where.id) ? { id: where.id } : null)
  },
  checkin: {
    create: async (args) => {
      state.createArgs = args;
      const created = fullCheckin({
        id: 'created_checkin',
        userId: args.data.userId,
        regionId: args.data.regionId,
        checkinDate: args.data.checkinDate,
        note: args.data.note,
        title: args.data.title,
        photos: args.data.photos.create.map((photo, index) => ({
          id: `created_photo_${index}`,
          ...photo,
          createdAt: new Date('2026-05-30T01:00:00.000Z')
        }))
      });
      state.checkins.push(created);
      return created;
    },
    findMany: async ({ where, take }) => {
      const rows = activeRows().filter((checkin) => {
        if (where?.OR) {
          return where.OR.some((condition) => (
            condition.checkinDate?.lt && checkin.checkinDate < condition.checkinDate.lt
          ) || (
            condition.checkinDate instanceof Date
              && checkin.checkinDate.getTime() === condition.checkinDate.getTime()
              && checkin.id < condition.id.lt
          ));
        }
        return true;
      });
      return take ? rows.slice(0, take) : rows;
    },
    findFirst: async ({ where }) => activeRows().find((checkin) => {
      if (where.id && checkin.id !== where.id) return false;
      if (where.userId && checkin.userId !== where.userId) return false;
      return true;
    }) || null,
    update: async (args) => {
      state.updateArgs = args;
      const row = state.checkins.find((checkin) => checkin.id === args.where.id);
      Object.assign(row, args.data, { updatedAt: new Date('2026-05-30T02:00:00.000Z') });
      return row;
    }
  },
  photo: {
    updateMany: async ({ where, data }) => {
      const row = state.checkins.find((checkin) => checkin.id === where.checkinId);
      if (row) {
        row.photos = row.photos.map((photo) => ({ ...photo, deletedAt: data.deletedAt }));
      }
      return { count: row?.photos.length || 0 };
    }
  },
  $transaction: async (operations) => Promise.all(operations)
};

function installMocks() {
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: prismaMock };
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (req, res, next) => {
      if (req.headers.authorization !== 'Bearer unit-token') {
        return res.status(401).json({ message: 'auth required' });
      }
      req.user = { id: 'user_1' };
      next();
    }
  };
  require.cache[uploadPath] = {
    id: uploadPath,
    filename: uploadPath,
    loaded: true,
    exports: {
      uploadPhotos: (req, res, next) => {
        req.mockPhotos = Array.isArray(req.body?.photos) ? req.body.photos : [];
        next();
      },
      uploadedPhotos: (req) => req.mockPhotos || [],
      validateUploadedFiles: async () => {
        if (state.failUploadValidation) {
          const error = new Error('bad upload');
          error.statusCode = 400;
          error.code = 'INVALID_UPLOAD_SIGNATURE';
          throw error;
        }
      },
      deleteLocalUpload: async (imageUrl) => {
        state.deletedUploads.push(imageUrl);
      }
    }
  };
  delete require.cache[routePath];
}

function makeApp() {
  installMocks();
  const app = express();
  app.use(express.json());
  app.use('/api/checkins', require(routePath));
  app.use(errorHandler);
  return app;
}

test.beforeEach(resetState);

test('checkin routes require authentication for every CRUD endpoint', async () => {
  const app = makeApp();

  await request(app).get('/api/checkins').expect(401);
  await request(app).post('/api/checkins').send({}).expect(401);
  await request(app).get('/api/checkins/checkin_1').expect(401);
  await request(app).put('/api/checkins/checkin_1').send({ title: 'Updated' }).expect(401);
  await request(app).delete('/api/checkins/checkin_1').expect(401);
});

test('POST /api/checkins creates a checkin with uploaded photos', async () => {
  const app = makeApp();

  const response = await request(app)
    .post('/api/checkins')
    .set('Authorization', 'Bearer unit-token')
    .send({
      regionId: 'region_1',
      checkinDate: '2026-05-30',
      title: 'Created',
      note: 'A note',
      photos: [{
        filename: 'unit.jpg',
        originalname: 'unit.jpg',
        mimetype: 'image/jpeg',
        size: 123
      }]
    })
    .expect(201);

  assert.equal(response.body.id, 'created_checkin');
  assert.equal(state.createArgs.data.userId, 'user_1');
  assert.equal(state.createArgs.data.regionId, 'region_1');
  assert.equal(state.createArgs.data.photos.create[0].imageUrl, '/uploads/unit.jpg');
});

test('POST /api/checkins validates required fields, photos, upload signatures, and missing regions', async () => {
  const app = makeApp();

  const invalidBody = await request(app)
    .post('/api/checkins')
    .set('Authorization', 'Bearer unit-token')
    .send({
      regionId: '',
      checkinDate: 'not-a-date',
      title: 'x'.repeat(101),
      note: 'x'.repeat(501),
      photos: [{ filename: 'unit.jpg', originalname: 'unit.jpg', mimetype: 'image/jpeg', size: 123 }]
    })
    .expect(400);
  assert.equal(invalidBody.body.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(invalidBody.body.details), /regionId/);
  assert.match(JSON.stringify(invalidBody.body.details), /ISO date/);

  const missingPhotos = await request(app)
    .post('/api/checkins')
    .set('Authorization', 'Bearer unit-token')
    .send({ regionId: 'region_1', checkinDate: '2026-05-30' })
    .expect(400);
  assert.match(JSON.stringify(missingPhotos.body.details), /at least one photo/);

  state.failUploadValidation = true;
  const badUpload = await request(app)
    .post('/api/checkins')
    .set('Authorization', 'Bearer unit-token')
    .send({
      regionId: 'region_1',
      checkinDate: '2026-05-30',
      photos: [{ filename: 'bad.jpg', originalname: 'bad.jpg', mimetype: 'image/jpeg', size: 123 }]
    })
    .expect(400);
  assert.equal(badUpload.body.code, 'INVALID_UPLOAD_SIGNATURE');
  assert.deepEqual(state.deletedUploads, ['/uploads/bad.jpg']);

  state.failUploadValidation = false;
  await request(app)
    .post('/api/checkins')
    .set('Authorization', 'Bearer unit-token')
    .send({
      regionId: 'missing_region',
      checkinDate: '2026-05-30',
      photos: [{ filename: 'unit.jpg', originalname: 'unit.jpg', mimetype: 'image/jpeg', size: 123 }]
    })
    .expect(404);
});

test('GET /api/checkins lists checkins and validates pagination cursors', async () => {
  const app = makeApp();

  const list = await request(app)
    .get('/api/checkins')
    .set('Authorization', 'Bearer unit-token')
    .expect(200);
  assert.equal(list.body.length, 2);
  assert.equal(list.body[0].id, 'checkin_1');

  const page = await request(app)
    .get('/api/checkins?limit=1')
    .set('Authorization', 'Bearer unit-token')
    .expect(200);
  assert.equal(page.body.data.length, 1);
  assert.equal(page.body.pagination.pageSize, 1);
  assert.equal(page.body.pagination.hasNextPage, true);
  assert.ok(page.body.pagination.nextCursor);

  await request(app)
    .get('/api/checkins?limit=1&cursor=not-a-cursor')
    .set('Authorization', 'Bearer unit-token')
    .expect(400);
});

test('GET /api/checkins/:id returns one checkin or 404', async () => {
  const app = makeApp();

  const response = await request(app)
    .get('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .expect(200);
  assert.equal(response.body.id, 'checkin_1');

  const missing = await request(app)
    .get('/api/checkins/missing')
    .set('Authorization', 'Bearer unit-token')
    .expect(404);
  assert.equal(missing.body.code, 'CHECKIN_NOT_FOUND');
});

test('PUT /api/checkins/:id updates allowed fields and rejects invalid updates', async () => {
  const app = makeApp();

  const updated = await request(app)
    .put('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .send({
      regionId: 'region_2',
      checkinDate: '2026-06-01',
      title: 'Updated',
      note: null
    })
    .expect(200);
  assert.equal(updated.body.title, 'Updated');
  assert.equal(updated.body.regionId, 'region_2');
  assert.equal(state.updateArgs.data.note, null);
  assert.equal(state.updateArgs.data.checkinDate.toISOString(), '2026-06-01T00:00:00.000Z');

  await request(app)
    .put('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .send({})
    .expect(400);

  await request(app)
    .put('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .send({ checkinDate: 'bad-date' })
    .expect(400);

  await request(app)
    .put('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .send({ regionId: 'missing_region' })
    .expect(404);

  await request(app)
    .put('/api/checkins/missing')
    .set('Authorization', 'Bearer unit-token')
    .send({ title: 'Nope' })
    .expect(404);
});

test('DELETE /api/checkins/:id soft deletes a checkin and its photos', async () => {
  const app = makeApp();

  const response = await request(app)
    .delete('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .expect(200);
  assert.equal(response.body.message, 'Checkin deleted.');
  assert.ok(state.checkins.find((checkin) => checkin.id === 'checkin_1').deletedAt);
  assert.deepEqual(state.deletedUploads, ['/uploads/unit-1.jpg']);

  await request(app)
    .delete('/api/checkins/checkin_1')
    .set('Authorization', 'Bearer unit-token')
    .expect(404);
});
