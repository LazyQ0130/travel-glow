const app = require('../server/app');
const prisma = require('../server/db');

function listen(serverApp) {
  return new Promise((resolve) => {
    const server = serverApp.listen(0, () => {
      resolve(server);
    });
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${data.message || response.statusText}`);
  }
  return data;
}

(async () => {
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await request(baseUrl, '/health');
    const login = await request(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'demo', password: '123456' })
    });
    await request(baseUrl, '/auth/me', {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    console.log('Smoke test passed.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
