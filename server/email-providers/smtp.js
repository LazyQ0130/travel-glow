const net = require('net');
const tls = require('tls');

function encodeBase64(value) {
  return Buffer.from(String(value), 'utf8').toString('base64');
}

function escapeAddress(address) {
  return String(address || '').replace(/[<>\r\n]/g, '').trim();
}

function normalizeLine(value) {
  return String(value || '').replace(/\r?\n/g, '\r\n');
}

class SmtpConnection {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = '';
    this.pending = [];
    this.queued = [];
    this.queuedDraft = null;
  }

  connectSocket() {
    return new Promise((resolve, reject) => {
      const options = {
        host: this.config.host,
        port: this.config.port,
        servername: this.config.host,
        timeout: this.config.timeoutMs
      };
      const socket = this.config.secure ? tls.connect(options) : net.connect(options);

      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const onTimeout = () => {
        cleanup();
        socket.destroy(new Error('SMTP connection timed out.'));
      };
      const onReady = () => {
        cleanup();
        this.setSocket(socket);
        resolve();
      };
      const cleanup = () => {
        socket.off('error', onError);
        socket.off('timeout', onTimeout);
        socket.off(this.config.secure ? 'secureConnect' : 'connect', onReady);
      };

      socket.once('error', onError);
      socket.once('timeout', onTimeout);
      socket.once(this.config.secure ? 'secureConnect' : 'connect', onReady);
    });
  }

  setSocket(socket) {
    this.socket = socket;
    this.socket.setTimeout(this.config.timeoutMs);
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (error) => this.rejectPending(error));
    this.socket.on('timeout', () => {
      this.socket.destroy(new Error('SMTP request timed out.'));
    });
  }

  onData(chunk) {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line) continue;
      const code = line.slice(0, 3);
      const done = line[3] !== '-';
      const pending = this.pending[0] || this.queuedDraft || { lines: [] };
      pending.lines.push(line);
      if (done) {
        const response = {
          code: Number(code),
          text: pending.lines.join('\n')
        };
        if (this.pending[0]) {
          this.pending.shift();
          pending.resolve(response);
        } else {
          this.queued.push(response);
          this.queuedDraft = null;
        }
      } else if (!this.pending[0]) {
        this.queuedDraft = pending;
      }
    }
  }

  rejectPending(error) {
    while (this.pending.length) {
      this.pending.shift().reject(error);
    }
  }

  readResponse() {
    if (this.queued.length) {
      return Promise.resolve(this.queued.shift());
    }
    if (this.queuedDraft) {
      return new Promise((resolve, reject) => {
        this.queuedDraft.resolve = resolve;
        this.queuedDraft.reject = reject;
        this.pending.push(this.queuedDraft);
        this.queuedDraft = null;
      });
    }
    return new Promise((resolve, reject) => {
      this.pending.push({ lines: [], resolve, reject });
    });
  }

  async command(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP command failed: ${response.text}`);
    }
    return response;
  }

  async startTls() {
    const original = this.socket;
    original.removeAllListeners('data');
    original.removeAllListeners('error');
    original.removeAllListeners('timeout');

    await new Promise((resolve, reject) => {
      const secureSocket = tls.connect({
        socket: original,
        servername: this.config.host
      }, () => {
        this.setSocket(secureSocket);
        resolve();
      });
      secureSocket.once('error', reject);
    });
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
    }
  }
}

function buildMessage({ from, to, subject, text }) {
  const safeFrom = escapeAddress(from);
  const safeTo = escapeAddress(to);
  const safeSubject = String(subject || '').replace(/[\r\n]/g, ' ').trim();
  const body = normalizeLine(text);
  return [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body.replace(/^\./gm, '..')
  ].join('\r\n');
}

async function sendMail({ to, subject, text, config }) {
  const connection = new SmtpConnection(config);

  try {
    await connection.connectSocket();
    await connection.readResponse();
    const hello = await connection.command('EHLO travel-glow.local', [250]);

    if (!config.secure && /\bSTARTTLS\b/i.test(hello.text)) {
      await connection.command('STARTTLS', [220]);
      await connection.startTls();
      await connection.command('EHLO travel-glow.local', [250]);
    }

    await connection.command('AUTH LOGIN', [334]);
    await connection.command(encodeBase64(config.user), [334]);
    await connection.command(encodeBase64(config.password), [235]);
    await connection.command(`MAIL FROM:<${escapeAddress(config.from)}>`, [250]);
    await connection.command(`RCPT TO:<${escapeAddress(to)}>`, [250, 251]);
    await connection.command('DATA', [354]);
    connection.socket.write(`${buildMessage({ from: config.from, to, subject, text })}\r\n.\r\n`);
    const dataResponse = await connection.readResponse();
    if (dataResponse.code !== 250) {
      throw new Error(`SMTP DATA failed: ${dataResponse.text}`);
    }
    await connection.command('QUIT', [221]);
  } finally {
    connection.close();
  }
}

module.exports = { sendMail };
