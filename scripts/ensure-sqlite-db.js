const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const root = path.resolve(__dirname, '..');
const schemaDir = path.join(root, 'prisma');
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

function isWindowsAbsolutePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function sqlitePathFromDatabaseUrl(url) {
  if (!url.startsWith('file:')) return null;
  const rawPath = decodeURIComponent(url.slice('file:'.length).split('?')[0]);
  if (!rawPath) return null;
  const normalized = rawPath.replace(/\//g, path.sep);
  if (path.isAbsolute(normalized) || isWindowsAbsolutePath(normalized)) {
    return normalized;
  }
  return path.resolve(schemaDir, normalized);
}

function ensureSqliteDatabaseFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const handle = fs.openSync(filePath, 'a');
  fs.closeSync(handle);
}

const sqlitePath = sqlitePathFromDatabaseUrl(databaseUrl);
if (sqlitePath) {
  ensureSqliteDatabaseFile(sqlitePath);
  console.log(`SQLite database file ready: ${sqlitePath}`);
}
