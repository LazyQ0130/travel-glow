const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.EXPOSE_DEV_EMAIL_CODE = 'true';

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

async function createAuthUser(prefix, password = 'TravelGlow!2026', extra = {}) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `${prefix}_${suffix}`.slice(0, 24);
  const user = await prisma.user.create({
    data: {
      username,
      nickname: `${prefix} Test`,
      passwordHash: await bcrypt.hash(password, 10),
      settings: { create: {} },
      ...extra
    }
  });
  return { user, username, password };
}

async function loginAs(identifier, password) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password })
  });
  const body = await json(response);
  assert.equal(response.status, 200);
  return body;
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
      email: `weak-${Date.now()}@travelglow.local`,
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
    body: JSON.stringify({ identifier: 'qyf', password: '123456' })
  });
  const login = await json(loginResponse);
  assert.equal(loginResponse.status, 200);
  assert.ok(login.token);

  const meResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const me = await json(meResponse);
  assert.equal(meResponse.status, 200);
  assert.equal(me.user.username, 'qyf');
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

test('mock email verification supports email login in development', async () => {
  const codeResponse = await request('/auth/email/send', {
    method: 'POST',
    body: JSON.stringify({ email: '321167759@qq.com', purpose: 'login' })
  });
  const codeBody = await json(codeResponse);
  assert.equal(codeResponse.status, 200);
  assert.match(codeBody.devCode, /^\d{6}$/);

  const loginResponse = await request('/auth/login/email', {
    method: 'POST',
    body: JSON.stringify({ email: '321167759@qq.com', code: codeBody.devCode })
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
    body: JSON.stringify({ identifier: 'qyf', password: '123456' })
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

test('security password verification validates the current password', async () => {
  const { user, username, password } = await createAuthUser('verify');
  const login = await loginAs(username, password);

  const badResponse = await request('/user/security/verify-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  const bad = await json(badResponse);
  assert.equal(badResponse.status, 400);
  assert.equal(bad.code, 'INVALID_PASSWORD');

  const okResponse = await request('/user/security/verify-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ password })
  });
  const ok = await json(okResponse);
  assert.equal(okResponse.status, 200);
  assert.equal(ok.verified, true);

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('password update can preserve or revoke other sessions', async () => {
  const originalPassword = 'TravelGlow!2026';
  const { user, username } = await createAuthUser('pwflow', originalPassword);
  const first = await loginAs(username, originalPassword);
  const second = await loginAs(username, originalPassword);

  const preserveResponse = await request('/user/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${first.token}` },
    body: JSON.stringify({
      oldPassword: originalPassword,
      newPassword: 'TravelGlow!2027',
      revokeOtherSessions: false
    })
  });
  assert.equal(preserveResponse.status, 200);

  const stillActiveResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${second.token}` }
  });
  assert.equal(stillActiveResponse.status, 200);

  const third = await loginAs(username, 'TravelGlow!2027');
  const revokeResponse = await request('/user/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${third.token}` },
    body: JSON.stringify({
      oldPassword: 'TravelGlow!2027',
      newPassword: 'TravelGlow!2028',
      revokeOtherSessions: true
    })
  });
  const revoke = await json(revokeResponse);
  assert.equal(revokeResponse.status, 200);
  assert.ok(revoke.revokedSessions >= 1);

  const revokedResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${second.token}` }
  });
  assert.equal(revokedResponse.status, 401);

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('registration requires a register email verification code', async () => {
  const password = 'TravelGlow!2026';
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const username = `reg_${suffix}`.slice(0, 24);
  const email = `reg-${suffix}@travelglow.local`;

  const codeResponse = await request('/auth/email/send', {
    method: 'POST',
    body: JSON.stringify({ email, purpose: 'register' })
  });
  const code = await json(codeResponse);
  assert.equal(codeResponse.status, 200);
  assert.match(code.devCode, /^\d{6}$/);

  const registerResponse = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      nickname: 'Email Register',
      email,
      password,
      code: code.devCode
    })
  });
  const registered = await json(registerResponse);
  assert.equal(registerResponse.status, 200);
  assert.ok(registered.token);
  assert.equal(registered.user.username, username);
  assert.match(registered.user.email, /\*/);

  await prisma.user.update({ where: { id: registered.user.id }, data: { deletedAt: new Date(), username: null, email: null } });
});

test('email verification binds a new email and rejects duplicates', async () => {
  const password = 'TravelGlow!2026';
  const { user, username } = await createAuthUser('emailbind', password);
  const taken = await createAuthUser('emailtaken', password, { email: `taken-${Date.now()}@travelglow.local` });
  const login = await loginAs(username, password);
  const nextEmail = `new-${Date.now()}@travelglow.local`;

  const duplicateCodeResponse = await request('/user/email/code', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ email: taken.user.email })
  });
  const duplicate = await json(duplicateCodeResponse);
  assert.equal(duplicateCodeResponse.status, 409);
  assert.equal(duplicate.code, 'EMAIL_IN_USE');

  const codeResponse = await request('/user/email/code', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ email: nextEmail })
  });
  const code = await json(codeResponse);
  assert.equal(codeResponse.status, 200);
  assert.match(code.devCode, /^\d{6}$/);

  const wrongCodeResponse = await request('/user/email', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ password, email: nextEmail, code: '000000' })
  });
  const wrongCode = await json(wrongCodeResponse);
  assert.equal(wrongCodeResponse.status, 400);
  assert.equal(wrongCode.code, 'EMAIL_CODE_INVALID');

  const bindResponse = await request('/user/email', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ password, email: nextEmail, code: code.devCode })
  });
  const bind = await json(bindResponse);
  assert.equal(bindResponse.status, 200);
  assert.match(bind.email, /\*/);

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null, email: null } });
  await prisma.user.update({ where: { id: taken.user.id }, data: { deletedAt: new Date(), username: null, email: null } });
});

test('session list marks the current device', async () => {
  const { user, username, password } = await createAuthUser('sessions');
  const login = await loginAs(username, password);

  const response = await request('/auth/sessions', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.ok(body.sessions.some((session) => session.isCurrent));

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('checkins support pagination and soft delete', async () => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'qyf', password: '123456' })
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
    body: JSON.stringify({ identifier: 'qyf', password: '123456' })
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
