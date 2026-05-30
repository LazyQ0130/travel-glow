const test = require('node:test');
const assert = require('node:assert/strict');

const { isStrongPassword, passwordIssues } = require('../../server/security/password-policy');

test('passwordIssues accepts strong passwords', () => {
  assert.deepEqual(passwordIssues('TravelGlow!2026'), []);
  assert.equal(isStrongPassword('TravelGlow!2026'), true);
});

test('passwordIssues reports missing password requirements', () => {
  const issues = passwordIssues('short');
  assert.ok(issues.includes('Password must be at least 10 characters.'));
  assert.ok(issues.includes('Password must include an uppercase letter.'));
  assert.ok(issues.includes('Password must include a number.'));
  assert.ok(issues.includes('Password must include a symbol.'));
});

test('passwordIssues rejects common passwords', () => {
  assert.ok(passwordIssues('12345678').includes('Password is too common.'));
  assert.equal(isStrongPassword('12345678'), false);
});

test('passwordIssues rejects overly long passwords', () => {
  const password = `A1!${'a'.repeat(70)}`;
  assert.ok(passwordIssues(password).includes('Password must be at most 72 characters.'));
});
