const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const backupDir = path.resolve(root, process.env.BACKUP_DIR || './backups');
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sqlitePathFromUrl(url) {
  const rawPath = url.replace(/^file:/, '').split('?')[0];
  if (path.isAbsolute(rawPath)) return rawPath;

  // Prisma 的 SQLite 相对路径通常以 schema.prisma 所在目录为基准。
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

function backupPostgres() {
  const target = path.join(backupDir, `postgres-${timestamp()}.dump`);
  const result = spawnSync('pg_dump', ['--dbname', databaseUrl, '--file', target, '--format', 'custom'], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.error) {
    throw new Error(`pg_dump 执行失败：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'pg_dump 执行失败。');
  }

  return target;
}

async function cleanupOldBackups() {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.promises.readdir(backupDir, { withFileTypes: true });
  const removed = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = path.join(backupDir, entry.name);
    const stat = await fs.promises.stat(filePath);
    if (stat.mtimeMs < cutoff) {
      // 遵守项目约束：只逐个删除明确路径的旧备份文件。
      await fs.promises.unlink(filePath);
      removed.push(filePath);
    }
  }

  return removed;
}

async function main() {
  await ensureBackupDir();

  let backupFile;
  if (databaseUrl.startsWith('file:')) {
    backupFile = await backupSqlite();
  } else if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    backupFile = backupPostgres();
  } else {
    throw new Error('暂不支持当前 DATABASE_URL，仅支持 SQLite file: 和 PostgreSQL URL。');
  }

  const removed = await cleanupOldBackups();
  console.log(`Backup created: ${backupFile}`);
  console.log(`Old backups removed: ${removed.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
