const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const typeScriptConfig = path.join(root, 'tsconfig.json');

if (fs.existsSync(typeScriptConfig)) {
  console.error('tsconfig.json exists, but no TypeScript typecheck command is configured.');
  process.exit(1);
}

console.log('Typecheck skipped: this project does not use TypeScript.');
