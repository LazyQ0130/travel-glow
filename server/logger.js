const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const { config } = require('./config');

const logger = pino({
  level: config.logLevel,
  base: {
    service: config.appName,
    version: config.version,
    env: config.env
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      '*.passwordHash',
      '*.token'
    ],
    censor: '[redacted]'
  }
});

function requestLogger() {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const requestId = req.headers['x-request-id'] || crypto.randomUUID();
      res.setHeader('X-Request-Id', requestId);
      return requestId;
    },
    customLogLevel(req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    }
  });
}

module.exports = { logger, requestLogger };
