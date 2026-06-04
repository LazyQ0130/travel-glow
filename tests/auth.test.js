const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.EMAIL_PROVIDER = 'mock';
process.env.EXPOSE_DEV_EMAIL_CODE = 'true';

const app = require('../server/app');
const prisma = require('../server/db');

let server;
let baseUrl;
let csrfCookie = '';
let csrfToken = '';

function isUnsafeMethod(method = 'GET') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

function rememberCsrf(response) {
  const token = response.headers.get('x-csrf-token');
  if (token) csrfToken = token;

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) csrfCookie = setCookie.split(';')[0];
}

async function ensureCsrfToken() {
  if (csrfCookie && csrfToken) return;
  const response = await fetch(`${baseUrl}/csrf-token`, {
    headers: csrfCookie ? { Cookie: csrfCookie } : {}
  });
  rememberCsrf(response);
  await response.arrayBuffer();
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  if (isUnsafeMethod(method)) {
    await ensureCsrfToken();
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
      ...(isUnsafeMethod(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  rememberCsrf(response);
  return response;
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

test('auth middleware does not convert session activity write failures into 401', async () => {
  const { user, username, password } = await createAuthUser('authwrite');
  const login = await loginAs(username, password);
  const originalUpdate = prisma.loginSession.update;

  prisma.loginSession.update = async () => {
    throw new Error('session activity write failed');
  };

  try {
    const response = await request('/auth/me', {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    const body = await json(response);

    assert.notEqual(response.status, 401);
    assert.equal(response.status, 500);
    assert.equal(body.code, 'INTERNAL_ERROR');
  } finally {
    prisma.loginSession.update = originalUpdate;
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
  }
});

test('unsafe requests require a valid CSRF token', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'missing-csrf', password: 'TravelGlow!2026' })
  });
  const body = await json(response);

  assert.equal(response.status, 403);
  assert.equal(body.code, 'CSRF_TOKEN_INVALID');
});

test('unsafe requests reject an invalid CSRF token', async () => {
  await ensureCsrfToken();
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: csrfCookie,
      'X-CSRF-Token': 'invalid-token'
    },
    body: JSON.stringify({ identifier: 'bad-csrf', password: 'TravelGlow!2026' })
  });
  const body = await json(response);

  assert.equal(response.status, 403);
  assert.equal(body.code, 'CSRF_TOKEN_INVALID');
});

test('registration rejects weak passwords before creating an account', async () => {
  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: `weak_${Date.now()}`,
      nickname: 'Weak Password',
      email: `weak-${Date.now()}@example.com`,
      password: '123456',
      code: '000000'
    })
  });
  const body = await json(response);
  assert.equal(response.status, 400);
  assert.equal(body.code, 'WEAK_PASSWORD');
});

test('registration rejects passwords with fewer than 3 character classes', async () => {
  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: `class_${Date.now()}`,
      nickname: 'Weak Classes',
      email: `weak-class-${Date.now()}@example.com`,
      password: 'abcdefgh',
      code: '000000'
    })
  });
  const body = await json(response);
  assert.equal(response.status, 400);
  assert.equal(body.code, 'WEAK_PASSWORD');
});

test('registration rejects duplicate emails before verifying the code', async () => {
  const taken = await createAuthUser('regtaken', 'Abcdef12', { email: `regtaken-${Date.now()}@example.com` });

  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: `dupe_${Date.now()}`,
      nickname: 'Duplicate Email',
      email: taken.user.email,
      password: 'Abcdef12',
      code: '000000'
    })
  });
  const body = await json(response);
  assert.equal(response.status, 409);
  assert.equal(body.code, 'EMAIL_IN_USE');

  await prisma.user.update({ where: { id: taken.user.id }, data: { deletedAt: new Date(), username: null, email: null } });
});

test('password login creates a server-validated session and logout revokes it', async () => {
  const { user, username, password } = await createAuthUser('loginflow');
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, password })
  });
  const login = await json(loginResponse);
  assert.equal(loginResponse.status, 200);
  assert.ok(login.token);

  const meResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const me = await json(meResponse);
  assert.equal(meResponse.status, 200);
  assert.equal(me.user.username, username);
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

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('mock email verification supports email login in development', async () => {
  const email = `email-login-${Date.now()}@example.com`;
  const { user } = await createAuthUser('emaillogin', 'TravelGlow!2026', {
    email,
    emailVerifiedAt: new Date()
  });

  const codeResponse = await request('/auth/email/send', {
    method: 'POST',
    body: JSON.stringify({ email, purpose: 'login' })
  });
  const codeBody = await json(codeResponse);
  assert.equal(codeResponse.status, 200);
  assert.match(codeBody.devCode, /^\d{6}$/);

  const loginResponse = await request('/auth/login/email', {
    method: 'POST',
    body: JSON.stringify({ email, code: codeBody.devCode })
  });
  const login = await json(loginResponse);
  assert.equal(loginResponse.status, 200);
  assert.ok(login.token);

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null, email: null } });
});

test('email code sending rejects local-only recipient domains', async () => {
  const email = `new-${Date.now()}@travelglow.local`;
  const before = await prisma.emailVerificationCode.count({ where: { email } });

  const response = await request('/auth/email/send', {
    method: 'POST',
    body: JSON.stringify({ email, purpose: 'register' })
  });
  const body = await json(response);

  assert.equal(response.status, 400);
  assert.equal(body.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(body.details), /publicly deliverable email address/);

  const after = await prisma.emailVerificationCode.count({ where: { email } });
  assert.equal(after, before);
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
  const { user, username, password } = await createAuthUser('settings');
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, password })
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

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('storage statistics only include the current user uploads', async () => {
  const owner = await createAuthUser('storagea');
  const other = await createAuthUser('storageb');
  const region = await prisma.region.findFirst({ where: { type: 'city' } });
  assert.ok(region);
  const now = new Date();

  try {
    const ownerCheckin = await prisma.checkin.create({
      data: {
        userId: owner.user.id,
        regionId: region.id,
        checkinDate: new Date('2026-05-30T00:00:00.000Z'),
        title: `storage-owner-${Date.now()}`
      }
    });
    const otherCheckin = await prisma.checkin.create({
      data: {
        userId: other.user.id,
        regionId: region.id,
        checkinDate: new Date('2026-05-30T00:00:00.000Z'),
        title: `storage-other-${Date.now()}`
      }
    });

    await prisma.photo.create({
      data: {
        userId: owner.user.id,
        checkinId: ownerCheckin.id,
        imageUrl: `/uploads/storage-owner-${Date.now()}.jpg`,
        originalName: 'owner.jpg',
        mimeType: 'image/jpeg',
        size: 1234
      }
    });
    await prisma.photo.create({
      data: {
        userId: other.user.id,
        checkinId: otherCheckin.id,
        imageUrl: `/uploads/storage-other-${Date.now()}.jpg`,
        originalName: 'other.jpg',
        mimeType: 'image/jpeg',
        size: 9999
      }
    });

    const login = await loginAs(owner.username, owner.password);
    const response = await request('/user/storage', {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    const body = await json(response);

    assert.equal(response.status, 200);
    assert.equal(body.photoCount, 1);
    assert.equal(body.checkinCount, 1);
    assert.equal(body.uploadFolderSize, 1234);
  } finally {
    await prisma.photo.updateMany({ where: { userId: { in: [owner.user.id, other.user.id] } }, data: { deletedAt: now } });
    await prisma.checkin.updateMany({ where: { userId: { in: [owner.user.id, other.user.id] } }, data: { deletedAt: now } });
    await prisma.user.update({ where: { id: owner.user.id }, data: { deletedAt: now, username: null } });
    await prisma.user.update({ where: { id: other.user.id }, data: { deletedAt: now, username: null } });
  }
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
  const password = 'Abcdef12';
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const username = `reg_${suffix}`.slice(0, 24);
  const email = `reg-${suffix}@example.com`;

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
  assert.equal(registered.user.email, email);

  await prisma.user.update({ where: { id: registered.user.id }, data: { deletedAt: new Date(), username: null, email: null } });
});

test('registration rejects an incorrect email verification code', async () => {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const username = `wrong_${suffix}`.slice(0, 24);
  const email = `wrong-${suffix}@example.com`;

  const codeResponse = await request('/auth/email/send', {
    method: 'POST',
    body: JSON.stringify({ email, purpose: 'register' })
  });
  assert.equal(codeResponse.status, 200);

  const registerResponse = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      nickname: 'Wrong Code',
      email,
      password: 'Abcdef12',
      code: '000000'
    })
  });
  const body = await json(registerResponse);
  assert.equal(registerResponse.status, 400);
  assert.equal(body.code, 'EMAIL_CODE_INVALID');
});

test('email verification binds a new email and rejects duplicates', async () => {
  const password = 'TravelGlow!2026';
  const { user, username } = await createAuthUser('emailbind', password);
  const taken = await createAuthUser('emailtaken', password, { email: `taken-${Date.now()}@example.com` });
  const login = await loginAs(username, password);
  const nextEmail = `new-${Date.now()}@example.com`;

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
  assert.equal(bind.email, nextEmail);

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null, email: null } });
  await prisma.user.update({ where: { id: taken.user.id }, data: { deletedAt: new Date(), username: null, email: null } });
});

test('profile update cannot directly change email verification state', async () => {
  const password = 'TravelGlow!2026';
  const originalEmail = `profile-email-${Date.now()}@example.com`;
  const originalVerifiedAt = new Date('2026-01-01T00:00:00.000Z');
  const { user, username } = await createAuthUser('profilemail', password, {
    email: originalEmail,
    emailVerifiedAt: originalVerifiedAt
  });
  const login = await loginAs(username, password);

  const response = await request('/user/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({
      nickname: 'Updated Profile',
      bio: 'Updated bio',
      email: `bypass-${Date.now()}@example.com`,
      emailVerifiedAt: new Date().toISOString()
    })
  });
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.nickname, 'Updated Profile');
  assert.equal(body.bio, 'Updated bio');

  const stored = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(stored.email, originalEmail);
  assert.equal(stored.emailVerifiedAt.toISOString(), originalVerifiedAt.toISOString());
  assert.equal(stored.nickname, 'Updated Profile');
  assert.equal(stored.bio, 'Updated bio');

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null, email: null } });
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
  const { user, username, password } = await createAuthUser('pageflow');
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, password })
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

  const pageResponse = await request('/checkins?limit=1', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  const page = await json(pageResponse);
  assert.equal(pageResponse.status, 200);
  assert.ok(Array.isArray(page.data));
  assert.equal(page.pagination.page, 1);
  assert.equal(page.pagination.pageSize, 1);
  assert.equal(page.pagination.total, null);
  assert.equal(page.pagination.totalPages, null);
  assert.ok(Object.hasOwn(page.pagination, 'nextCursor'));

  if (page.pagination.nextCursor) {
    const nextPageResponse = await request(`/checkins?limit=1&cursor=${encodeURIComponent(page.pagination.nextCursor)}`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    const nextPage = await json(nextPageResponse);
    assert.equal(nextPageResponse.status, 200);
    assert.equal(nextPage.pagination.hasPreviousPage, true);
    assert.notEqual(nextPage.data[0]?.id, page.data[0]?.id);
  }

  const invalidCursorResponse = await request('/checkins?limit=1&cursor=not-a-cursor', {
    headers: { Authorization: `Bearer ${login.token}` }
  });
  assert.equal(invalidCursorResponse.status, 400);

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

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('checkin creation validates body fields and photo count', async () => {
  const { user, username, password } = await createAuthUser('createval2');
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, password })
  });
  const login = await json(loginResponse);
  const region = await prisma.region.findFirst({ where: { type: 'city' } });
  assert.ok(region);

  const invalidBodyForm = new FormData();
  invalidBodyForm.set('regionId', region.id);
  invalidBodyForm.set('checkinDate', 'not-a-date');
  invalidBodyForm.set('title', 'x'.repeat(101));
  invalidBodyForm.set('note', 'x'.repeat(501));

  const invalidBodyResponse = await request('/checkins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: invalidBodyForm
  });
  const invalidBody = await json(invalidBodyResponse);
  assert.equal(invalidBodyResponse.status, 400);
  assert.equal(invalidBody.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(invalidBody.details.fieldErrors.checkinDate), /ISO date/);
  assert.match(JSON.stringify(invalidBody.details.fieldErrors.title), /100 characters/);
  assert.match(JSON.stringify(invalidBody.details.fieldErrors.note), /500 characters/);

  const missingPhotosForm = new FormData();
  missingPhotosForm.set('regionId', region.id);
  missingPhotosForm.set('checkinDate', '2026-05-30');

  const missingPhotosResponse = await request('/checkins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}` },
    body: missingPhotosForm
  });
  const missingPhotos = await json(missingPhotosResponse);
  assert.equal(missingPhotosResponse.status, 400);
  assert.equal(missingPhotos.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(missingPhotos.details.fieldErrors.photos), /at least one photo/);

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});

test('photo upload rejects files with a mismatched image signature', async () => {
  const { user, username, password } = await createAuthUser('sigreject');
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, password })
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
  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), username: null } });
});
