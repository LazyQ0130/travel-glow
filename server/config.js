require('dotenv').config();

const unsafeJwtSecrets = new Set([
  '',
  'dev-secret',
  'change-this-secret-before-production',
  'travel-glow-local-dev-secret'
]);

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return Number(raw);
}

function booleanFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

const emailProvider = String(process.env.EMAIL_PROVIDER || 'mock').trim().toLowerCase();
const isProduction = process.env.NODE_ENV === 'production';

const config = {
  appName: 'travel-glow',
  version: '1.0.0',
  env: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  corsOrigins: csv(process.env.CORS_ORIGINS),
  trustProxy: booleanFromEnv('TRUST_PROXY', false),
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  logDir: process.env.LOG_DIR || './logs',
  logFile: process.env.LOG_FILE || 'app.log',
  logMaxSize: process.env.LOG_MAX_SIZE || '10m',
  logRetentionDays: numberFromEnv('LOG_RETENTION_DAYS', numberFromEnv('LOG_MAX_FILES', isProduction ? 30 : 7)),
  emailProvider,
  exposeDevEmailCode: booleanFromEnv('EXPOSE_DEV_EMAIL_CODE', false),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: numberFromEnv('SMTP_PORT', 587),
    secure: booleanFromEnv('SMTP_SECURE', false),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    timeoutMs: numberFromEnv('SMTP_TIMEOUT_MS', 10000)
  },
  redis: {
    enabled: booleanFromEnv('RATE_LIMIT_REDIS_ENABLED', Boolean(process.env.REDIS_HOST || isProduction)),
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: numberFromEnv('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || '',
    db: numberFromEnv('REDIS_DB', 0),
    poolSize: numberFromEnv('REDIS_POOL_SIZE', isProduction ? 4 : 2),
    connectTimeoutMs: numberFromEnv('REDIS_CONNECT_TIMEOUT_MS', 1000),
    commandTimeoutMs: numberFromEnv('REDIS_COMMAND_TIMEOUT_MS', 500),
    failureCooldownMs: numberFromEnv('REDIS_FAILURE_COOLDOWN_MS', 30000)
  },
  isProduction
};

function assertRuntimeConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  if (config.isProduction && unsafeJwtSecrets.has(config.jwtSecret)) {
    throw new Error('JWT_SECRET must be set to a strong unique value in production.');
  }

  if (config.isProduction && config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  if (config.isProduction && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in production.');
  }

  if (config.isProduction && config.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must include the production frontend origin.');
  }

  if (!Number.isInteger(config.logRetentionDays) || config.logRetentionDays < 1) {
    throw new Error('LOG_RETENTION_DAYS or LOG_MAX_FILES must be a positive integer.');
  }

  if (!['smtp', 'mock'].includes(config.emailProvider)) {
    throw new Error('EMAIL_PROVIDER must be one of: smtp, mock.');
  }

  if (config.isProduction && config.emailProvider === 'mock') {
    throw new Error('EMAIL_PROVIDER must be smtp in production.');
  }

  if (!Number.isInteger(config.smtp.port) || config.smtp.port < 1 || config.smtp.port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }

  if (!Number.isInteger(config.smtp.timeoutMs) || config.smtp.timeoutMs < 1000 || config.smtp.timeoutMs > 30000) {
    throw new Error('SMTP_TIMEOUT_MS must be an integer between 1000 and 30000.');
  }

  if (config.emailProvider === 'smtp') {
    const required = [
      ['SMTP_HOST', config.smtp.host],
      ['SMTP_USER', config.smtp.user],
      ['SMTP_PASSWORD', config.smtp.password],
      ['SMTP_FROM', config.smtp.from]
    ];

    for (const [name, value] of required) {
      if (!value) {
        throw new Error(`${name} must be set when EMAIL_PROVIDER=smtp.`);
      }
    }
  }

  if (config.redis.enabled) {
    if (!config.redis.host) {
      throw new Error('REDIS_HOST must be set when RATE_LIMIT_REDIS_ENABLED=true.');
    }

    if (!Number.isInteger(config.redis.port) || config.redis.port < 1 || config.redis.port > 65535) {
      throw new Error('REDIS_PORT must be an integer between 1 and 65535.');
    }

    if (!Number.isInteger(config.redis.db) || config.redis.db < 0) {
      throw new Error('REDIS_DB must be a non-negative integer.');
    }

    if (!Number.isInteger(config.redis.poolSize) || config.redis.poolSize < 1 || config.redis.poolSize > 10) {
      throw new Error('REDIS_POOL_SIZE must be an integer between 1 and 10.');
    }

    if (!Number.isInteger(config.redis.connectTimeoutMs) || config.redis.connectTimeoutMs < 100 || config.redis.connectTimeoutMs > 30000) {
      throw new Error('REDIS_CONNECT_TIMEOUT_MS must be an integer between 100 and 30000.');
    }

    if (!Number.isInteger(config.redis.commandTimeoutMs) || config.redis.commandTimeoutMs < 100 || config.redis.commandTimeoutMs > 30000) {
      throw new Error('REDIS_COMMAND_TIMEOUT_MS must be an integer between 100 and 30000.');
    }

    if (!Number.isInteger(config.redis.failureCooldownMs) || config.redis.failureCooldownMs < 1000) {
      throw new Error('REDIS_FAILURE_COOLDOWN_MS must be an integer greater than or equal to 1000.');
    }
  }
}

function corsOptions() {
  const sharedOptions = { exposedHeaders: ['X-CSRF-Token'] };

  if (!config.isProduction) {
    return { origin: true, ...sharedOptions };
  }

  return {
    ...sharedOptions,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    }
  };
}

module.exports = { config, assertRuntimeConfig, corsOptions };
