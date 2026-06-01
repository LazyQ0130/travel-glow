const test = require('node:test');
const assert = require('node:assert/strict');

const rateLimit = require('../../server/middleware/rate-limit');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('rateLimit returns retry metadata after the request budget is exhausted', async () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: `unit-${Date.now()}` });
  const req = { ip: '127.0.0.1', socket: {} };

  const first = createResponse();
  let nextCalls = 0;
  await limiter(req, first, () => {
    nextCalls += 1;
  });

  const second = createResponse();
  await limiter(req, second, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(second.statusCode, 429);
  assert.equal(second.headers['retry-after'], String(second.body.details.retryAfterSeconds));
  assert.equal(second.body.code, 'RATE_LIMITED');
  assert.ok(second.body.details.retryAfterSeconds > 0);
});
