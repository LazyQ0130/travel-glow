const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const app = require('../server/app');
const prisma = require('../server/db');

let server;
let baseUrl;

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
}

async function json(response) {
  return response.json().catch(() => ({}));
}

test.before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test('health endpoint returns service metadata', async () => {
  const response = await request('/health');
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.name, 'travel-glow');
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('ready endpoint checks database connectivity', async () => {
  const response = await request('/ready');
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ready');
  assert.equal(body.database, 'ok');
});

test('protected endpoints reject missing and invalid tokens with uniform error format', async () => {
  const missingResponse = await request('/auth/me');
  const missing = await json(missingResponse);
  assert.equal(missingResponse.status, 401);
  assert.equal(typeof missing.message, 'string');

  const invalidResponse = await request('/auth/me', {
    headers: { Authorization: 'Bearer invalid-token' }
  });
  const invalid = await json(invalidResponse);
  assert.equal(invalidResponse.status, 401);
  assert.equal(typeof invalid.message, 'string');
});

test('registration rejects weak passwords before creating an account', async () => {
  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: `weak_${Date.now()}`,
      nickname: 'Weak Password',
      phone: `139${Date.now().toString().slice(-8)}`,
      password: '123456',
      code: '000000'
    })
  });
  const body = await json(response);
  assert.equal(response.status, 400);
  assert.equal(body.code, 'WEAK_PASSWORD');
});

test('password login creates a server-validated session and logout revokes it', async () => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'demo', password: '123456' })
  });
  const login = await json(loginResponse);
  assert.equal(loginResponse.status, 200);
  assert.ok(login.token);

  const meResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const me = await json(meResponse);
  assert.equal(meResponse.status, 200);
  assert.equal(me.user.username, 'demo');
  assert.ok(Array.isArray(me.sessions));

  const logoutResponse = await request('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({})
  });
  assert.equal(logoutResponse.status, 200);

  const revokedResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  assert.equal(revokedResponse.status, 401);
});

test('mock phone verification supports phone login in development', async () => {
  const codeResponse = await request('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800000000', purpose: 'login' })
  });
  const codeBody = await json(codeResponse);
  assert.equal(codeResponse.status, 200);
  assert.match(codeBody.devCode, /^\d{6}$/);

  const loginResponse = await request('/auth/login/phone', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800000000', code: codeBody.devCode })
  });
  const login = await json(loginResponse);
  assert.equal(loginResponse.status, 200);
  assert.ok(login.token);
});

test('password login locks an account after repeated failures', async () => {
  const passwordHash = await bcrypt.hash('Strong!Pass123', 10);
  const username = `lock_${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      username,
      nickname: 'Lock Test',
      passwordHash,
      settings: { create: {} }
    }
  });

  for (let index = 0; index < 5; index += 1) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: username, password: 'wrong-password' })
    });
    assert.equal(response.status, 401);
  }

  const lockedResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, password: 'Strong!Pass123' })
  });
  const locked = await json(lockedResponse);
  assert.equal(lockedResponse.status, 423);
  assert.equal(locked.code, 'ACCOUNT_LOCKED');

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('settings update persists for the current user', async () => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'demo', password: '123456' })
  });
  const login = await json(loginResponse);

  const updateResponse = await request('/user/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ mapTheme: 'aurora', glowColor: 'emerald' })
  });
  const updated = await json(updateResponse);
  assert.equal(updateResponse.status, 200);
  assert.equal(updated.mapTheme, 'aurora');
  assert.equal(updated.glowColor, 'emerald');

  const meResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const me = await json(meResponse);
  assert.equal(me.settings.mapTheme, 'aurora');
  assert.equal(me.settings.glowColor, 'emerald');
});

test('checkins support pagination and soft delete', async () => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'demo', password: '123456' })
  });
  const login = await json(loginResponse);
  const region = await prisma.region.findFirst({ where: { type: 'city' } });
  assert.ok(region);

  const checkin = await prisma.checkin.create({
    data: {
      userId: login.user.id,
      regionId: region.id,
      checkinDate: new Date('2026-05-30T00:00:00.000Z'),
      title: `pagination-test-${Date.now()}`
    }
  });

  const pageResponse = await request('/checkins?page=1&pageSize=1', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const page = await json(pageResponse);
  assert.equal(pageResponse.status, 200);
  assert.ok(Array.isArray(page.data));
  assert.equal(page.pagination.page, 1);
  assert.equal(page.pagination.pageSize, 1);

  const deleteResponse = await request(`/checkins/${checkin.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${login.token}` }
  });
  assert.equal(deleteResponse.status, 200);

  const deleted = await prisma.checkin.findUnique({ where: { id: checkin.id } });
  assert.ok(deleted.deletedAt);

  const getDeletedResponse = await request(`/checkins/${checkin.id}`, {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  assert.equal(getDeletedResponse.status, 404);
});

test('photo upload rejects files with a mismatched image signature', async () => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'demo', password: '123456' })
  });
  const login = await json(loginResponse);
  const region = await prisma.region.findFirst({ where: { type: 'city' } });
  const checkin = await prisma.checkin.create({
    data: {
      userId: login.user.id,
      regionId: region.id,
      checkinDate: new Date('2026-05-30T00:00:00.000Z'),
      title: `upload-security-test-${Date.now()}`
    }
  });

  const form = new FormData();
  form.append('checkinId', checkin.id);
  form.append('photos', new Blob(['not really a jpeg'], { type: 'image/jpeg' }), 'fake.jpg');

  const response = await request('/photos/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: form
  });
  const body = await json(response);
  assert.equal(response.status, 400);
  assert.equal(body.code, 'INVALID_UPLOAD_SIGNATURE');

  await prisma.checkin.update({ where: { id: checkin.id }, data: { deletedAt: new Date() } });
});
