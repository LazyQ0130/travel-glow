const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const backupDir = path.resolve(root, process.env.BACKUP_DIR || './backups');
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const uploadsDir = path.resolve(root, process.env.UPLOADS_DIR || './server/uploads');
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sqlitePathFromUrl(url) {
  const rawPath = url.replace(/^file:/, '').split('?')[0];
  if (path.isAbsolute(rawPath)) return rawPath;

  const candidates = [
    path.resolve(root, rawPath),
    path.resolve(root, 'prisma', rawPath)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

async function ensureBackupDir() {
  await fs.promises.mkdir(backupDir, { recursive: true });
}

async function backupSqlite() {
  const source = sqlitePathFromUrl(databaseUrl);
  await fs.promises.access(source, fs.constants.R_OK);

  const ext = path.extname(source) || '.db';
  const target = path.join(backupDir, `sqlite-${timestamp()}${ext}`);
  await fs.promises.copyFile(source, target);
  return target;
}

async function backupUploads() {
  if (!fs.existsSync(uploadsDir)) return null;

  const target = path.join(backupDir, `uploads-${timestamp()}.tar.gz`);
  const result = spawnSync('tar', ['-czf', target, '-C', path.dirname(uploadsDir), path.basename(uploadsDir)], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.error) {
    throw new Error(`tar failed: ${result.error.message}. Install tar or set UPLOADS_DIR to an existing upload directory.`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'tar failed.');
  }

  return target;
}

function backupPostgres() {
  const target = path.join(backupDir, `postgres-${timestamp()}.dump`);
  const result = spawnSync('pg_dump', ['--dbname', databaseUrl, '--file', target, '--format', 'custom'], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.error) {
    throw new Error(`pg_dump failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'pg_dump failed.');
  }

  return target;
}

async function cleanupOldBackups() {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('BACKUP_RETENTION_DAYS must be a positive number.');
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.promises.readdir(backupDir, { withFileTypes: true });
  const removed = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = path.join(backupDir, entry.name);
    const stat = await fs.promises.stat(filePath);
    if (stat.mtimeMs < cutoff) {
      await fs.promises.unlink(filePath);
      removed.push(filePath);
    }
  }

  return removed;
}

async function main() {
  await ensureBackupDir();

  const created = [];
  if (databaseUrl.startsWith('file:')) {
    created.push(await backupSqlite());
  } else if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    created.push(backupPostgres());
  } else {
    throw new Error('Unsupported DATABASE_URL. Only SQLite file: and PostgreSQL URLs are supported.');
  }

  const uploadsBackup = await backupUploads();
  if (uploadsBackup) {
    created.push(uploadsBackup);
  }

  const removed = await cleanupOldBackups();
  console.log(`Backups created: ${created.join(', ')}`);
  console.log(`Old backups removed: ${removed.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
