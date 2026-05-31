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

const smsProvider = String(process.env.SMS_PROVIDER || 'mock').trim().toLowerCase();

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
  smsProvider,
  sms: {
    provider: smsProvider,
    accessKey: process.env.SMS_ACCESS_KEY || '',
    accessSecret: process.env.SMS_ACCESS_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '',
    templateCode: process.env.SMS_TEMPLATE_CODE || '',
    templateParamName: process.env.SMS_TEMPLATE_PARAM_NAME || 'code',
    appId: process.env.SMS_APP_ID || process.env.SMS_TENCENT_APP_ID || process.env.SMS_SDK_APP_ID || '',
    region: process.env.SMS_REGION || 'ap-guangzhou',
    defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || '+86',
    timeoutMs: numberFromEnv('SMS_TIMEOUT_MS', 5000),
    aliyunEndpoint: process.env.SMS_ALIYUN_ENDPOINT || 'https://dysmsapi.aliyuncs.com/',
    tencentEndpoint: process.env.SMS_TENCENT_ENDPOINT || 'https://sms.tencentcloudapi.com/'
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

  if (!['aliyun', 'tencent', 'mock'].includes(config.sms.provider)) {
    throw new Error('SMS_PROVIDER must be one of: aliyun, tencent, mock.');
  }

  if (!Number.isInteger(config.sms.timeoutMs) || config.sms.timeoutMs < 1000 || config.sms.timeoutMs > 30000) {
    throw new Error('SMS_TIMEOUT_MS must be an integer between 1000 and 30000.');
  }

  if (config.sms.provider !== 'mock') {
    const required = [
      ['SMS_ACCESS_KEY', config.sms.accessKey],
      ['SMS_ACCESS_SECRET', config.sms.accessSecret],
      ['SMS_SIGN_NAME', config.sms.signName],
      ['SMS_TEMPLATE_CODE', config.sms.templateCode]
    ];

    for (const [name, value] of required) {
      if (!value) {
        throw new Error(`${name} must be set when SMS_PROVIDER=${config.sms.provider}.`);
      }
    }
  }

  if (config.sms.provider === 'tencent' && !config.sms.appId) {
    throw new Error('SMS_APP_ID must be set when SMS_PROVIDER=tencent.');
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
