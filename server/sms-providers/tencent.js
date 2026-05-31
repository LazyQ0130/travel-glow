const crypto = require('crypto');

const SERVICE = 'sms';
const ACTION = 'SendSms';
const VERSION = '2021-01-11';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(secret, value, encoding) {
  return crypto.createHmac('sha256', secret).update(value).digest(encoding);
}

function formatPhone(phone, defaultCountryCode) {
  const normalized = String(phone || '').trim();
  if (normalized.startsWith('+') || !defaultCountryCode) return normalized;
  return `${defaultCountryCode}${normalized.replace(/^0+/, '')}`;
}

async function request(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.Response?.Error?.Message || `Tencent SMS API returned HTTP ${response.status}.`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function createAuthorization({ secretId, secretKey, host, payload, timestamp }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload)
  ].join('\n');
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign, 'hex');

  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function sendVerificationCode({ phone, code, config }) {
  const endpoint = new URL(config.tencentEndpoint);
  const host = endpoint.host;
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    PhoneNumberSet: [formatPhone(phone, config.defaultCountryCode)],
    SmsSdkAppId: config.appId,
    SignName: config.signName,
    TemplateId: config.templateCode,
    TemplateParamSet: [code]
  });

  const body = await request(endpoint.origin, {
    method: 'POST',
    headers: {
      Authorization: createAuthorization({
        secretId: config.accessKey,
        secretKey: config.accessSecret,
        host,
        payload,
        timestamp
      }),
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': ACTION,
      'X-TC-Version': VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': config.region
    },
    body: payload
  }, config.timeoutMs);

  const response = body.Response || {};
  if (response.Error) {
    throw new Error(response.Error.Message || `Tencent SMS send failed with code ${response.Error.Code || 'UNKNOWN'}.`);
  }

  const status = response.SendStatusSet?.[0];
  if (!status || status.Code !== 'Ok') {
    throw new Error(status?.Message || `Tencent SMS send failed with code ${status?.Code || 'UNKNOWN'}.`);
  }

  return {
    provider: 'tencent',
    requestId: response.RequestId,
    serialNo: status.SerialNo
  };
}

module.exports = { sendVerificationCode };
