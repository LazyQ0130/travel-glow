const test = require('node:test');
const assert = require('node:assert/strict');

const { maskEmail } = require('../../server/utils/mask');

test('maskEmail masks the username and keeps domain visible', () => {
  assert.equal(maskEmail('alice@example.com'), '***@example.com');
  assert.equal(maskEmail('a@travel.test'), '***@travel.test');
});

test('maskEmail keeps empty or invalid values unchanged', () => {
  assert.equal(maskEmail(undefined), undefined);
  assert.equal(maskEmail('not-an-email'), 'not-an-email');
});
