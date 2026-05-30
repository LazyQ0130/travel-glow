const test = require('node:test');
const assert = require('node:assert/strict');
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
