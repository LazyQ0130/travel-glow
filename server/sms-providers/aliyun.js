const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function encode(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join('&');
}

async function request(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.Message || body.message || `Aliyun SMS API returned HTTP ${response.status}.`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendVerificationCode({ phone, code, config }) {
  const endpoint = new URL(config.aliyunEndpoint);
  const host = endpoint.host;
  const payloadHash = sha256('');
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomUUID();

  const params = {
    PhoneNumbers: phone,
    SignName: config.signName,
    TemplateCode: config.templateCode,
    TemplateParam: JSON.stringify({ [config.templateParamName]: code })
  };

  const query = canonicalQuery(params);
  const headers = {
    host,
    'x-acs-action': 'SendSms',
    'x-acs-version': '2017-05-25',
    'x-acs-date': date,
    'x-acs-signature-nonce': nonce,
    'x-acs-content-sha256': payloadHash
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key}:${headers[key]}\n`)
    .join('');
  const canonicalRequest = [
    'POST',
    '/',
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const stringToSign = `ACS3-HMAC-SHA256\n${sha256(canonicalRequest)}`;
  const signature = hmac(config.accessSecret, stringToSign);

  const body = await request(`${endpoint.origin}/?${query}`, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: `ACS3-HMAC-SHA256 Credential=${config.accessKey},SignedHeaders=${signedHeaders},Signature=${signature}`
    }
  }, config.timeoutMs);

  if (body.Code !== 'OK') {
    throw new Error(body.Message || `Aliyun SMS send failed with code ${body.Code || 'UNKNOWN'}.`);
  }

  return {
    provider: 'aliyun',
    requestId: body.RequestId,
    bizId: body.BizId
  };
}

module.exports = { sendVerificationCode };
