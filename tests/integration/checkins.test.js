const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const sharp = require('sharp');

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.EMAIL_PROVIDER = 'mock';

const app = require('../../server/app');
const prisma = require('../../server/db');
const { config } = require('../../server/config');
const { deleteLocalUpload } = require('../../server/upload');

const createdUsers = [];
const createdCheckins = [];
const createdRegions = [];
const uploadedUrls = [];

function suffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function imageBuffer() {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 40, g: 120, b: 200 }
    }
  }).jpeg().toBuffer();
}

async function createRegion(label = 'integration') {
  const id = `region_${label}_${suffix()}`.slice(0, 64);
  const region = await prisma.region.create({
    data: {
      id,
      name: `Integration ${label}`,
      shortName: label,
      type: 'city',
      code: id,
      regionType: 'city',
      sortOrder: 0
    }
  });
  createdRegions.push(region.id);
  return region;
}

async function createAuthContext(prefix = 'checkins') {
  const password = 'TravelGlow!2026';
  const username = `${prefix}_${suffix()}`.slice(0, 24);
  const user = await prisma.user.create({
    data: {
      username,
      nickname: `${prefix} Test`,
      passwordHash: await bcrypt.hash(password, 10),
      settings: { create: {} }
    }
  });
  createdUsers.push(user.id);

  const session = await prisma.loginSession.create({ data: { userId: user.id } });
  const token = jwt.sign({ userId: user.id, sessionId: session.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  return { user, token };
}

async function createCheckin(userId, regionId, data = {}) {
  const checkin = await prisma.checkin.create({
    data: {
      userId,
      regionId,
      checkinDate: data.checkinDate || new Date('2026-05-30T00:00:00.000Z'),
      title: data.title || `integration-${suffix()}`,
      note: data.note
    }
  });
  createdCheckins.push(checkin.id);
  return checkin;
}

async function cleanup() {
  while (createdCheckins.length) {
    const id = createdCheckins.pop();
    const checkin = await prisma.checkin.findUnique({
      where: { id },
      include: { photos: true }
    }).catch(() => null);
    if (!checkin) continue;

    const now = new Date();
    await prisma.photo.updateMany({ where: { checkinId: id }, data: { deletedAt: now } });
    await prisma.checkin.update({ where: { id }, data: { deletedAt: now } }).catch(() => null);
    for (const photo of checkin.photos) {
      await deleteLocalUpload(photo.imageUrl);
    }
  }

  while (uploadedUrls.length) {
    await deleteLocalUpload(uploadedUrls.pop());
  }

  while (createdRegions.length) {
    const id = createdRegions.pop();
    await prisma.region.delete({ where: { id } }).catch(() => null);
  }

  while (createdUsers.length) {
    const id = createdUsers.pop();
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), username: null, email: null }
    }).catch(() => null);
  }
}

test.afterEach(cleanup);

test.after(async () => {
  await prisma.$disconnect();
});

test('checkins authentication middleware protects all CRUD endpoints', async () => {
  await request(app).get('/api/checkins').expect(401);
  await request(app).post('/api/checkins').send({}).expect(401);
  await request(app).get('/api/checkins/missing').expect(401);
  await request(app).put('/api/checkins/missing').send({ title: 'Updated' }).expect(401);
  await request(app).delete('/api/checkins/missing').expect(401);

  await request(app)
    .get('/api/checkins')
    .set('Authorization', 'Bearer invalid-token')
    .expect(401);
});

test('checkins CRUD flow works through HTTP with supertest', async () => {
  const region = await createRegion('crud_a');
  const nextRegion = await createRegion('crud_b');
  const owner = await createAuthContext('crud');
  const other = await createAuthContext('other');
  const photo = await imageBuffer();

  const createResponse = await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${owner.token}`)
    .field('regionId', region.id)
    .field('checkinDate', '2026-05-30')
    .field('title', 'First HTTP checkin')
    .field('note', 'Created by integration test')
    .attach('photos', photo, { filename: 'checkin.jpg', contentType: 'image/jpeg' })
    .expect(201);

  createdCheckins.push(createResponse.body.id);
  uploadedUrls.push(...createResponse.body.photos.map((item) => item.imageUrl));
  assert.equal(createResponse.body.userId, owner.user.id);
  assert.equal(createResponse.body.regionId, region.id);
  assert.equal(createResponse.body.photos.length, 1);

  const listResponse = await request(app)
    .get('/api/checkins')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.ok(listResponse.body.some((item) => item.id === createResponse.body.id));

  const pageResponse = await request(app)
    .get('/api/checkins?limit=1')
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.ok(Array.isArray(pageResponse.body.data));
  assert.equal(pageResponse.body.pagination.pageSize, 1);
  assert.ok(Object.hasOwn(pageResponse.body.pagination, 'nextCursor'));

  const getResponse = await request(app)
    .get(`/api/checkins/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.equal(getResponse.body.id, createResponse.body.id);
  assert.equal(getResponse.body.region.id, region.id);

  await request(app)
    .get(`/api/checkins/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${other.token}`)
    .expect(404);

  const updateResponse = await request(app)
    .put(`/api/checkins/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({
      regionId: nextRegion.id,
      checkinDate: '2026-06-01',
      title: 'Updated HTTP checkin',
      note: null
    })
    .expect(200);
  assert.equal(updateResponse.body.regionId, nextRegion.id);
  assert.equal(updateResponse.body.title, 'Updated HTTP checkin');
  assert.equal(updateResponse.body.note, null);

  await request(app)
    .put(`/api/checkins/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${other.token}`)
    .send({ title: 'Forbidden update' })
    .expect(404);

  const deleteResponse = await request(app)
    .delete(`/api/checkins/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(200);
  assert.equal(deleteResponse.body.message, 'Checkin deleted.');

  await request(app)
    .get(`/api/checkins/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${owner.token}`)
    .expect(404);

  const deleted = await prisma.checkin.findUnique({
    where: { id: createResponse.body.id },
    include: { photos: true }
  });
  assert.ok(deleted.deletedAt);
  assert.ok(deleted.photos.every((item) => item.deletedAt));
});

test('checkins reject invalid create payloads and upload boundaries', async () => {
  const region = await createRegion('validation');
  const { token } = await createAuthContext('createval');
  const photo = await imageBuffer();

  const emptyBody = await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Missing required fields')
    .expect(400);
  assert.equal(emptyBody.body.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(emptyBody.body.details), /regionId/);

  const invalidFields = await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${token}`)
    .field('regionId', region.id)
    .field('checkinDate', 'not-a-date')
    .field('title', 'x'.repeat(101))
    .field('note', 'x'.repeat(501))
    .attach('photos', photo, { filename: 'invalid.jpg', contentType: 'image/jpeg' })
    .expect(400);
  assert.equal(invalidFields.body.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(invalidFields.body.details), /ISO date/);
  assert.match(JSON.stringify(invalidFields.body.details), /100 characters/);
  assert.match(JSON.stringify(invalidFields.body.details), /500 characters/);

  const missingPhotos = await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${token}`)
    .field('regionId', region.id)
    .field('checkinDate', '2026-05-30')
    .expect(400);
  assert.equal(missingPhotos.body.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(missingPhotos.body.details), /at least one photo/);

  const invalidRegion = await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${token}`)
    .field('regionId', 'missing-region')
    .field('checkinDate', '2026-05-30')
    .attach('photos', photo, { filename: 'missing-region.jpg', contentType: 'image/jpeg' })
    .expect(404);
  assert.equal(invalidRegion.body.code, 'REGION_NOT_FOUND');

  const badSignature = await request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${token}`)
    .field('regionId', region.id)
    .field('checkinDate', '2026-05-30')
    .attach('photos', Buffer.from('not a real jpeg'), { filename: 'fake.jpg', contentType: 'image/jpeg' })
    .expect(400);
  assert.equal(badSignature.body.code, 'INVALID_UPLOAD_SIGNATURE');

  const tooMany = request(app)
    .post('/api/checkins')
    .set('Authorization', `Bearer ${token}`)
    .field('regionId', region.id)
    .field('checkinDate', '2026-05-30');
  for (let index = 0; index < 10; index += 1) {
    tooMany.attach('photos', photo, { filename: `photo-${index}.jpg`, contentType: 'image/jpeg' });
  }
  const tooManyResponse = await tooMany.expect(400);
  assert.equal(tooManyResponse.body.code, 'UPLOAD_TOO_MANY_FILES');
});

test('checkins reject invalid update payloads and missing records', async () => {
  const region = await createRegion('update_a');
  const missingRegionTarget = await createRegion('update_b');
  const { user, token } = await createAuthContext('updateval');
  const checkin = await createCheckin(user.id, region.id);

  const empty = await request(app)
    .put(`/api/checkins/${checkin.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({})
    .expect(400);
  assert.equal(empty.body.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(empty.body.details), /At least one field/);

  const invalidDate = await request(app)
    .put(`/api/checkins/${checkin.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ checkinDate: '06/01/2026' })
    .expect(400);
  assert.equal(invalidDate.body.code, 'VALIDATION_ERROR');

  const invalidText = await request(app)
    .put(`/api/checkins/${checkin.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'x'.repeat(101), note: 'x'.repeat(501) })
    .expect(400);
  assert.equal(invalidText.body.code, 'VALIDATION_ERROR');

  const missingRegion = await request(app)
    .put(`/api/checkins/${checkin.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ regionId: `${missingRegionTarget.id}_missing` })
    .expect(404);
  assert.equal(missingRegion.body.code, 'REGION_NOT_FOUND');

  const missingCheckin = await request(app)
    .put('/api/checkins/missing-checkin')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'No record' })
    .expect(404);
  assert.equal(missingCheckin.body.code, 'CHECKIN_NOT_FOUND');
});
