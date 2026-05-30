const test = require('node:test');
const assert = require('node:assert/strict');

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const app = require('../../server/app');
const prisma = require('../../server/db');

let server;
let baseUrl;

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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

test('security headers are enabled and implementation header is hidden', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
});

test('JSON request body larger than 1mb is rejected', async () => {
  const payload = JSON.stringify({ value: 'a'.repeat(1024 * 1024 + 1) });
  const response = await request('/auth/login', {
    method: 'POST',
    body: payload
  });
  const body = await json(response);
  assert.equal(response.status, 413);
  assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
});
