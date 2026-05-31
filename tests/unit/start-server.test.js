const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const { startServer } = require('../../server/start-server');

function createLogger() {
  const entries = [];
  return {
    entries,
    info(...args) {
      entries.push({ level: 'info', args });
    },
    error(...args) {
      entries.push({ level: 'error', args });
    }
  };
}

test('startServer exits cleanly when the configured port is already in use', async () => {
  const logger = createLogger();
  let exitCode;
  let server;

  const app = {
    listen(port, callback) {
      server = new EventEmitter();
      server.close = (closeCallback) => closeCallback();
      callback();
      return server;
    }
  };

  startServer(app, {
    config: { port: 3000 },
    logger,
    prisma: { $disconnect: async () => {} },
    registerSignals: false,
    exit(code) {
      exitCode = code;
    }
  });

  server.emit('error', Object.assign(new Error('listen EADDRINUSE: address already in use :::3000'), {
    code: 'EADDRINUSE'
  }));

  assert.equal(exitCode, 1);
  assert.ok(
    logger.entries.some((entry) => (
      entry.level === 'error'
      && String(entry.args[1]).includes('Port 3000 is already in use')
    ))
  );
});
