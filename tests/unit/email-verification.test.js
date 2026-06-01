const test = require('node:test');
const assert = require('node:assert/strict');

process.env.EMAIL_PROVIDER = 'mock';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const { isValidEmail, normalizeEmail } = require('../../server/email-verification');

test('normalizeEmail trims and lowercases user input before storage or delivery', () => {
  assert.equal(normalizeEmail('  Alice+Login@Example.COM  '), 'alice+login@example.com');
});

test('isValidEmail accepts public email domains and rejects local-only domains', () => {
  assert.equal(isValidEmail('alice+login@example.com'), true);
  assert.equal(isValidEmail('new-1780297543715@travelglow.local'), false);
  assert.equal(isValidEmail('new-1780297543715@localhost'), false);
  assert.equal(isValidEmail('bad-address'), false);
});
