const weakPasswords = new Set([
  '123456',
  '12345678',
  '123456789',
  'password',
  'qwerty123',
  'abc123456',
  '11111111'
]);

function passwordIssues(password) {
  const value = String(password || '');
  const issues = [];

  if (value.length < 10) issues.push('Password must be at least 10 characters.');
  if (value.length > 72) issues.push('Password must be at most 72 characters.');
  if (!/[a-z]/.test(value)) issues.push('Password must include a lowercase letter.');
  if (!/[A-Z]/.test(value)) issues.push('Password must include an uppercase letter.');
  if (!/\d/.test(value)) issues.push('Password must include a number.');
  if (!/[^A-Za-z0-9]/.test(value)) issues.push('Password must include a symbol.');
  if (weakPasswords.has(value.toLowerCase())) issues.push('Password is too common.');

  return issues;
}

function isStrongPassword(password) {
  return passwordIssues(password).length === 0;
}

module.exports = { passwordIssues, isStrongPassword };
