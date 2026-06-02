const crypto = require('crypto');

const CSRF_COOKIE = 'travel_glow_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signedCookieValue(secret, signingKey) {
  return `${secret}.${hmac(signingKey, `csrf-cookie:${secret}`)}`;
}

function verifyCookieValue(value, signingKey) {
  const text = String(value || '');
  const separator = text.lastIndexOf('.');
  if (separator <= 0) return null;

  const secret = text.slice(0, separator);
  const signature = text.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{32,}$/.test(secret)) return null;
  if (!safeEqual(signature, hmac(signingKey, `csrf-cookie:${secret}`))) return null;
  return secret;
}

function csrfToken(secret, signingKey) {
  return hmac(signingKey, `csrf-token:${secret}`);
}

function submittedToken(req) {
  return req.get(CSRF_HEADER)
    || req.get('csrf-token')
    || req.body?._csrf
    || req.query?._csrf
    || '';
}

function createCsrfProtection(options = {}) {
  const {
    cookieName = CSRF_COOKIE,
    headerName = CSRF_HEADER,
    signingKey,
    secure = false,
    sameSite = 'strict',
    path = '/api'
  } = options;

  if (!signingKey) {
    throw new Error('CSRF signing key is required.');
  }

  return function csrfProtection(req, res, next) {
    let secret = verifyCookieValue(req.cookies?.[cookieName], signingKey);
    if (!secret) {
      secret = crypto.randomBytes(32).toString('base64url');
      res.cookie(cookieName, signedCookieValue(secret, signingKey), {
        httpOnly: true,
        sameSite,
        secure,
        path
      });
    }

    const token = csrfToken(secret, signingKey);
    req.csrfToken = () => token;
    res.locals.csrfToken = token;
    res.set(headerName, token);

    if (!SAFE_METHODS.has(req.method.toUpperCase()) && !safeEqual(submittedToken(req), token)) {
      const error = new Error('Invalid CSRF token.');
      error.code = 'EBADCSRFTOKEN';
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
}

module.exports = { createCsrfProtection };
