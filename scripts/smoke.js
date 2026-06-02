process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const bcrypt = require('bcryptjs');
const app = require('../server/app');
const prisma = require('../server/db');

let csrfCookie = '';
let csrfToken = '';

function listen(serverApp) {
  return new Promise((resolve) => {
    const server = serverApp.listen(0, () => {
      resolve(server);
    });
  });
}

function isUnsafeMethod(method = 'GET') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
}

function rememberCsrf(response) {
  const token = response.headers.get('x-csrf-token');
  if (token) csrfToken = token;

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) csrfCookie = setCookie.split(';')[0];
}

async function ensureCsrfToken(baseUrl) {
  if (csrfCookie && csrfToken) return;
  const response = await fetch(`${baseUrl}/csrf-token`, {
    headers: csrfCookie ? { Cookie: csrfCookie } : {}
  });
  rememberCsrf(response);
  await response.arrayBuffer();
}

async function request(baseUrl, path, options = {}) {
  const method = options.method || 'GET';
  if (isUnsafeMethod(method)) {
    await ensureCsrfToken(baseUrl);
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
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.message || response.statusText}`);
  }
  return data;
}

async function createSmokeUser() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const password = 'TravelGlow!2026';
  const user = await prisma.user.create({
    data: {
      username: `smoke_${suffix}`.slice(0, 24),
      nickname: 'Smoke Test',
      email: `smoke-${suffix}@example.com`,
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(password, 10),
      settings: { create: {} }
    }
  });
  return { user, password };
}

(async () => {
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  let smokeUser;
  try {
    smokeUser = await createSmokeUser();
    await request(baseUrl, '/health');
    const login = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: smokeUser.user.username, password: smokeUser.password })
    });
    await request(baseUrl, '/auth/me', {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    console.log('Smoke test passed.');
  } finally {
    if (smokeUser) {
      await prisma.user.update({
        where: { id: smokeUser.user.id },
        data: { deletedAt: new Date(), username: null, email: null }
      }).catch(() => {});
    }
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
