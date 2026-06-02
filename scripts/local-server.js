#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const rootDir = path.resolve(__dirname, '..');
const logsDir = path.join(rootDir, 'logs');
const pidPath = path.join(logsDir, 'server.pid');
const port = Number(process.env.PORT || 3000);
const baseUrl = `http://localhost:${port}`;

function usage() {
  console.log('Usage: node scripts/local-server.js <start|stop|restart|status>');
}

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
}

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function logPaths() {
  const suffix = today();
  return {
    stdout: path.join(logsDir, `server-${suffix}.out.log`),
    stderr: path.join(logsDir, `server-${suffix}.err.log`)
  };
}

function readPid() {
  try {
    const value = Number(fs.readFileSync(pidPath, 'utf8').trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writePid(pid) {
  ensureLogsDir();
  fs.writeFileSync(pidPath, `${pid}\n`);
}

function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function requestHealth(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const request = http.get(`${baseUrl}/api/health`, { timeout: timeoutMs }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await requestHealth()) return true;
    await wait(500);
  }
  return false;
}

function readTail(filePath, maxBytes = 4000) {
  try {
    const stats = fs.statSync(filePath);
    const start = Math.max(0, stats.size - maxBytes);
    const length = stats.size - start;
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    fs.closeSync(fd);
    return buffer.toString('utf8').trim();
  } catch {
    return '';
  }
}

async function start() {
  ensureLogsDir();

  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid) && await requestHealth()) {
    console.log(`Travel Glow is already running at ${baseUrl} (PID ${existingPid}).`);
    return;
  }

  if (await requestHealth()) {
    console.log(`Travel Glow is already responding at ${baseUrl}.`);
    return;
  }

  const paths = logPaths();
  const stdout = fs.openSync(paths.stdout, 'a');
  const stderr = fs.openSync(paths.stderr, 'a');
  const child = spawn(process.execPath, ['server/app.js'], {
    cwd: rootDir,
    detached: true,
    env: process.env,
    stdio: ['ignore', stdout, stderr],
    windowsHide: true
  });

  fs.closeSync(stdout);
  fs.closeSync(stderr);
  writePid(child.pid);

  const healthy = await waitForHealth();
  child.unref();

  if (!healthy) {
    const errorTail = readTail(paths.stderr);
    console.error(`Travel Glow did not become healthy at ${baseUrl}.`);
    console.error(`PID: ${child.pid}`);
    console.error(`stdout: ${paths.stdout}`);
    console.error(`stderr: ${paths.stderr}`);
    if (errorTail) {
      console.error('\nRecent stderr:');
      console.error(errorTail);
    }
    process.exit(1);
  }

  console.log(`Travel Glow running at ${baseUrl}`);
  console.log(`PID: ${child.pid}`);
  console.log(`stdout: ${paths.stdout}`);
  console.log(`stderr: ${paths.stderr}`);
}

async function stop() {
  const pid = readPid();
  if (!pid) {
    console.log('No local Travel Glow PID file found.');
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log(`Travel Glow PID ${pid} is not running.`);
    return;
  }

  process.kill(pid, 'SIGTERM');
  for (let index = 0; index < 30; index += 1) {
    if (!isProcessRunning(pid)) {
      console.log(`Stopped Travel Glow PID ${pid}.`);
      return;
    }
    await wait(500);
  }

  console.error(`Travel Glow PID ${pid} did not stop after SIGTERM.`);
  process.exit(1);
}

async function status() {
  const pid = readPid();
  const running = pid && isProcessRunning(pid);
  const healthy = await requestHealth();

  if (running && healthy) {
    console.log(`Travel Glow is running at ${baseUrl} (PID ${pid}).`);
    return;
  }

  if (running) {
    console.log(`Travel Glow PID ${pid} is running, but ${baseUrl}/api/health is not healthy.`);
    process.exit(1);
  }

  if (healthy) {
    console.log(`Travel Glow is responding at ${baseUrl}, but no matching PID file was found.`);
    return;
  }

  console.log('Travel Glow is not running.');
  process.exit(1);
}

async function main() {
  const command = process.argv[2] || 'start';
  if (command === 'start') return start();
  if (command === 'stop') return stop();
  if (command === 'status') return status();
  if (command === 'restart') {
    await stop().catch(() => {});
    return start();
  }

  usage();
  process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exit(1);
  });
}

module.exports = {
  baseUrl,
  isProcessRunning,
  logPaths,
  pidPath,
  readPid,
  requestHealth,
  readTail
};
