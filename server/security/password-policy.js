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
  const characterClasses = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ].filter(Boolean).length;

  if (value.length < 8) issues.push('Password must be at least 8 characters.');
  if (value.length > 72) issues.push('Password must be at most 72 characters.');
  if (characterClasses < 3) {
    issues.push('Password must include at least 3 of lowercase letters, uppercase letters, numbers, and symbols.');
  }
  if (weakPasswords.has(value.toLowerCase())) issues.push('Password is too common.');

  return issues;
}

function isStrongPassword(password) {
  return passwordIssues(password).length === 0;
}

module.exports = { passwordIssues, isStrongPassword };
