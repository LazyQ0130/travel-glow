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

const config = {
  appName: 'travel-glow',
  version: '1.0.0',
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  corsOrigins: csv(process.env.CORS_ORIGINS),
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  smsProvider: process.env.SMS_PROVIDER || 'mock',
  isProduction: process.env.NODE_ENV === 'production'
};

function assertRuntimeConfig() {
  if (config.isProduction && unsafeJwtSecrets.has(config.jwtSecret)) {
    throw new Error('JWT_SECRET must be set to a strong unique value in production.');
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
