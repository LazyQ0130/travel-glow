const test = require('node:test');
const assert = require('node:assert/strict');

const { maskEmail, maskPhone } = require('../../server/utils/mask');

test('maskPhone replaces the middle four digits', () => {
  assert.equal(maskPhone('13812345678'), '138****5678');
  assert.equal(maskPhone('15500001111'), '155****1111');
});

test('maskPhone keeps empty and short values unchanged', () => {
  assert.equal(maskPhone(null), null);
  assert.equal(maskPhone('123456'), '123456');
});

test('maskEmail masks the username and keeps domain visible', () => {
  assert.equal(maskEmail('alice@example.com'), '***@example.com');
  assert.equal(maskEmail('a@travel.test'), '***@travel.test');
});

test('maskEmail keeps empty or invalid values unchanged', () => {
  assert.equal(maskEmail(undefined), undefined);
  assert.equal(maskEmail('not-an-email'), 'not-an-email');
});
