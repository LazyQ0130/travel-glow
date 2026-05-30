const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const nodeFiles = [
  'server/app.js',
  'server/audit.js',
  'server/config.js',
  'server/db.js',
  'server/errors.js',
  'server/logger.js',
  'server/pagination.js',
  'server/start.js',
  'server/sms.js',
  'server/upload.js',
  'server/user-utils.js',
  'server/utils/mask.js',
  'server/middleware/auth.js',
  'server/middleware/rate-limit.js',
  'server/middleware/validate.js',
  'server/security/password-policy.js',
  'server/services/auth-service.js',
  'server/services/content-service.js',
  'server/routes/auth.js',
  'server/routes/user.js',
  'server/routes/regions.js',
  'server/routes/checkins.js',
  'server/routes/photos.js',
  'server/routes/stats.js',
  'server/routes/map.js',
  'scripts/backup.js',
  'public/me-app.js',
  'prisma/seed.js',
  'data/seed-data.js'
];

for (const file of nodeFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
for (const [index, match] of inlineScripts.entries()) {
  try {
    new Function(match[1]);
  } catch (error) {
    console.error(`Inline script ${index + 1} in public/index.html has a syntax error:`);
    console.error(error);
    process.exit(1);
  }
}

console.log('Syntax check passed.');
