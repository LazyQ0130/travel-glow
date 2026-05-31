function maskEmail(email) {
  if (!email) return email;
  const value = String(email);
  const atIndex = value.indexOf('@');
  if (atIndex <= 0) return value;
  return `***${value.slice(atIndex)}`;
}

module.exports = { maskEmail };
