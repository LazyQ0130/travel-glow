function maskPhone(phone) {
  if (!phone) return phone;
  const value = String(phone);
  if (value.length < 7) return value;

  // 只脱敏中间4位，保留原始号码前后可识别部分。
  return `${value.slice(0, 3)}****${value.slice(7)}`;
}

function maskEmail(email) {
  if (!email) return email;
  const value = String(email);
  const atIndex = value.indexOf('@');
  if (atIndex <= 0) return value;

  // 邮箱只保留域名，用户名统一替换为固定掩码。
  return `***${value.slice(atIndex)}`;
}

module.exports = { maskPhone, maskEmail };
