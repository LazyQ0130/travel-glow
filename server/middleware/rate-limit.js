const { config } = require('../config');

const memoryBuckets = new Map();

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

let Redis;
let redisStore;

function loadRedis() {
  if (!Redis) {
    Redis = require('ioredis');
  }

  return Redis;
}

function consumeMemoryBucket(key, windowMs, now) {
  const current = memoryBuckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  memoryBuckets.set(key, current);

  if (memoryBuckets.size > 1000) {
    for (const [bucketKey, bucket] of memoryBuckets) {
      if (bucket.resetAt <= now) memoryBuckets.delete(bucketKey);
    }
  }

  return current;
}

function writeRedisFallbackWarning(error, cooldownMs, state) {
  const now = Date.now();
  if (now - state.lastWarningAt < cooldownMs) return;

  state.lastWarningAt = now;
  process.stderr.write(`Rate limit Redis unavailable; using in-memory fallback. ${error.message}\n`);
}

class RedisRateLimitStore {
  constructor(options) {
    this.options = options;
    this.clients = Array.from({ length: options.poolSize }, () => ({
      client: null,
      connecting: null
    }));
    this.nextClientIndex = 0;
    this.disabledUntil = 0;
    this.warningState = { lastWarningAt: 0 };
  }

  createClient() {
    const RedisClient = loadRedis();
    const client = new RedisClient({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password || undefined,
      db: this.options.db,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: this.options.connectTimeoutMs,
      commandTimeout: this.options.commandTimeoutMs,
      keepAlive: 10000,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      reconnectOnError(error) {
        return String(error.message || '').includes('READONLY') ? 2 : false;
      }
    });

    client.on('error', (error) => this.markFailure(error));
    return client;
  }

  markFailure(error) {
    this.disabledUntil = Date.now() + this.options.failureCooldownMs;
    writeRedisFallbackWarning(error, this.options.failureCooldownMs, this.warningState);
  }

  isDisabled() {
    return Date.now() < this.disabledUntil;
  }

  nextSlot() {
    const slot = this.clients[this.nextClientIndex];
    this.nextClientIndex = (this.nextClientIndex + 1) % this.clients.length;
    return slot;
  }

  async connect(slot) {
    if (!slot.client || slot.client.status === 'end') {
      slot.client = this.createClient();
    }

    if (slot.client.status === 'ready') {
      return slot.client;
    }

    if (slot.connecting) {
      await slot.connecting;
      return slot.client.status === 'ready' ? slot.client : null;
    }

    if (slot.client.status !== 'wait') {
      slot.client.disconnect();
      slot.client = this.createClient();
    }

    slot.connecting = slot.client.connect()
      .catch((error) => {
        this.markFailure(error);
        throw error;
      })
      .finally(() => {
        slot.connecting = null;
      });

    await slot.connecting;
    return slot.client.status === 'ready' ? slot.client : null;
  }

  async consume(key, windowMs, now) {
    if (this.isDisabled()) {
      return null;
    }

    const slot = this.nextSlot();

    try {
      const client = await this.connect(slot);
      if (!client) return null;

      const result = await client.eval(RATE_LIMIT_SCRIPT, 1, key, String(windowMs));
      const count = Number(result[0]);
      const ttlMs = Math.max(0, Number(result[1]));

      return {
        count,
        resetAt: now + ttlMs
      };
    } catch (error) {
      this.markFailure(error);
      return null;
    }
  }
}

function getRedisStore() {
  if (!config.redis.enabled) return null;

  if (!redisStore) {
    redisStore = new RedisRateLimitStore(config.redis);
  }

  return redisStore;
}

function applyRateLimitResponse(req, res, next, current, max, now) {
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

  if (current.count > max) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      message: '请求过于频繁，请稍后再试',
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds }
    });
  }

  return next();
}

function rateLimit({ windowMs, max, keyPrefix = 'global' }) {
  return async (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `travel-glow:rate-limit:${keyPrefix}:${ip}`;
    const now = Date.now();
    const redis = getRedisStore();
    const current = (redis && await redis.consume(key, windowMs, now)) || consumeMemoryBucket(key, windowMs, now);

    return applyRateLimitResponse(req, res, next, current, max, now);
  };
}

module.exports = rateLimit;
