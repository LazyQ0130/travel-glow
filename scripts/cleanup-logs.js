const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const daysArg = [...args].find((arg) => arg.startsWith('--days='));
const retentionDays = Number(
  daysArg ? daysArg.slice('--days='.length) : (process.env.LOG_RETENTION_DAYS || 30)
);
const logDir = path.resolve(process.cwd(), process.env.LOG_DIR || './logs');

if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  console.error('LOG_RETENTION_DAYS or --days must be a positive integer.');
  process.exit(1);
}

function listExpiredLogs() {
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  let entries;
  try {
    entries = fs.readdirSync(logDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.log'))
    .map((entry) => {
      const filePath = path.join(logDir, entry.name);
      return { filePath, stats: fs.statSync(filePath) };
    })
    .filter((entry) => entry.stats.mtimeMs < cutoff)
    .sort((left, right) => left.stats.mtimeMs - right.stats.mtimeMs);
}

const expiredLogs = listExpiredLogs();

if (expiredLogs.length === 0) {
  console.log(`No log files older than ${retentionDays} days in ${logDir}.`);
  process.exit(0);
}

console.log(`${expiredLogs.length} log file(s) older than ${retentionDays} days:`);
for (const entry of expiredLogs) {
  console.log(entry.filePath);
}

if (!apply) {
  console.log('Dry run only. Re-run with --apply to delete these files one by one.');
  process.exit(0);
}

for (const entry of expiredLogs) {
  fs.unlinkSync(entry.filePath);
  console.log(`Deleted ${entry.filePath}`);
}
