const buckets = new Map();

function rateLimit({ windowMs, max, keyPrefix = 'global' }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    buckets.set(key, current);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      return res.status(429).json({
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMITED',
        details: { retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) }
      });
    }

    next();
  };
}

module.exports = rateLimit;
