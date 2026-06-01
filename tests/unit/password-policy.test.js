const test = require('node:test');
const assert = require('node:assert/strict');

const { isStrongPassword, passwordIssues } = require('../../server/security/password-policy');

test('passwordIssues accepts strong passwords', () => {
  assert.deepEqual(passwordIssues('TravelGlow!2026'), []);
  assert.equal(isStrongPassword('TravelGlow!2026'), true);
  assert.deepEqual(passwordIssues('Abcdef12'), []);
  assert.equal(isStrongPassword('Abcdef12'), true);
});

test('passwordIssues reports missing password requirements', () => {
  const issues = passwordIssues('short');
  assert.ok(issues.includes('Password must be at least 8 characters.'));
  assert.ok(issues.includes('Password must include at least 3 of lowercase letters, uppercase letters, numbers, and symbols.'));
});

test('passwordIssues rejects passwords with fewer than 3 character classes', () => {
  const issues = passwordIssues('abcdefgh');
  assert.ok(issues.includes('Password must include at least 3 of lowercase letters, uppercase letters, numbers, and symbols.'));
  assert.equal(isStrongPassword('abcdefgh'), false);

  const twoClassIssues = passwordIssues('abcdef12');
  assert.ok(twoClassIssues.includes('Password must include at least 3 of lowercase letters, uppercase letters, numbers, and symbols.'));
  assert.equal(isStrongPassword('abcdef12'), false);
});

test('passwordIssues rejects common passwords', () => {
  assert.ok(passwordIssues('12345678').includes('Password is too common.'));
  assert.equal(isStrongPassword('12345678'), false);
});

test('passwordIssues rejects overly long passwords', () => {
  const password = `A1!${'a'.repeat(70)}`;
  assert.ok(passwordIssues(password).includes('Password must be at most 72 characters.'));
});
