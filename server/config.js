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
  emailProvider,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: numberFromEnv('SMTP_PORT', 587),
    secure: booleanFromEnv('SMTP_SECURE', false),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    timeoutMs: numberFromEnv('SMTP_TIMEOUT_MS', 10000)
  },
  isProduction: process.env.NODE_ENV === 'production'
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
}

function corsOptions() {
  if (!config.isProduction) {
    return { origin: true };
  }

  return {
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    }
  };
}

module.exports = { config, assertRuntimeConfig, corsOptions };
