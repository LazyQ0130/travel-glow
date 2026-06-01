const fs = require('fs');
const path = require('path');
const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const { config } = require('./config');

const LEVEL_LABELS = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal'
};

const LEVEL_COLORS = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m'
};

const RESET_COLOR = '\x1b[0m';

function parseSize(value, fallback) {
  const match = String(value || '').trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(b|k|kb|m|mb|g|gb)?$/);
  if (!match) return fallback;

  const amount = Number(match[1]);
  const unit = match[2] || 'b';
  const multipliers = {
    b: 1,
    k: 1024,
    kb: 1024,
    m: 1024 * 1024,
    mb: 1024 * 1024,
    g: 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };

  return Math.floor(amount * multipliers[unit]);
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function resolveLogDir(logDir) {
  return path.resolve(process.cwd(), logDir || './logs');
}

function resolveLogFile(logDir, logFile) {
  if (path.isAbsolute(logFile)) {
    return logFile;
  }

  if (logFile.includes('/') || logFile.includes('\\')) {
    return path.resolve(process.cwd(), logFile);
  }

  return path.join(logDir, logFile);
}

function datedFilePath(filePath, stamp) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(path.dirname(filePath), `${base}-${stamp}${ext || '.log'}`);
}

function rotateFilePath(filePath, index) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(path.dirname(filePath), `${base}.${index}${ext || '.log'}`);
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

function cleanupExpiredLogs(logDir, retentionDays, now = new Date()) {
  const cutoff = now.getTime() - (retentionDays * 24 * 60 * 60 * 1000);
  let entries;

  try {
    entries = fs.readdirSync(logDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.log')) continue;

    const filePath = path.join(logDir, entry.name);
    const stats = fs.statSync(filePath);
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
    }
  }
}

function formatConsoleLine(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch (error) {
    return line;
  }

  const level = LEVEL_LABELS[entry.level] || 'info';
  const color = LEVEL_COLORS[level] || '';
  const time = entry.time || new Date().toISOString();
  const requestId = entry.req && entry.req.id ? ` req=${entry.req.id}` : '';
  const message = entry.msg || '';
  const err = entry.err || entry.error;
  const errorLine = err && (err.stack || err.message) ? `\n${err.stack || err.message}` : '';

  return `${color}${time} ${level.toUpperCase().padEnd(5)}${RESET_COLOR}${requestId} ${message}${errorLine}\n`;
}

function createLogStream(options) {
  const logDir = resolveLogDir(options.logDir);
  const configuredFile = resolveLogFile(logDir, options.logFile);
  const maxSizeBytes = parseSize(options.maxSize, 10 * 1024 * 1024);
  const retentionDays = options.retentionDays;
  let lastCleanupStamp = '';

  fs.mkdirSync(path.dirname(configuredFile), { recursive: true });

  function currentFilePath() {
    if (!options.isProduction) {
      return configuredFile;
    }
    return datedFilePath(configuredFile, dateStamp());
  }

  function cleanupIfNeeded() {
    const stamp = dateStamp();
    if (stamp === lastCleanupStamp) return;
    lastCleanupStamp = stamp;
    cleanupExpiredLogs(path.dirname(configuredFile), retentionDays);
  }

  function ensureWritableFile(line) {
    cleanupIfNeeded();

    const basePath = currentFilePath();
    const lineBytes = Buffer.byteLength(line);
    const baseSize = fileSize(basePath);
    if (baseSize === 0 || baseSize + lineBytes <= maxSizeBytes) {
      return basePath;
    }

    for (let index = 1; index < 1000; index += 1) {
      const nextPath = rotateFilePath(basePath, index);
      const nextSize = fileSize(nextPath);
      if (nextSize === 0 || nextSize + lineBytes <= maxSizeBytes) {
        return nextPath;
      }
    }

    return rotateFilePath(basePath, Date.now());
  }

  return {
    write(line) {
      if (!line.endsWith('\n')) {
        line += '\n';
      }

      if (!options.isProduction) {
        const output = formatConsoleLine(line);
        const target = line.includes('"level":50') || line.includes('"level":60') ? process.stderr : process.stdout;
        target.write(output);
      }

      try {
        fs.appendFileSync(ensureWritableFile(line), line, 'utf8');
      } catch (error) {
        if (!options.isProduction) {
          process.stderr.write(`Logger file write failed: ${error.message}\n`);
        }
      }
    }
  };
}

const logStream = createLogStream({
  logDir: config.logDir,
  logFile: config.logFile,
  maxSize: config.logMaxSize,
  retentionDays: config.logRetentionDays,
  isProduction: config.isProduction
});

const logger = pino({
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: config.appName,
    version: config.version,
    env: config.env
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
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
}, logStream);

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
