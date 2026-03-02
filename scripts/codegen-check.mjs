import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const generatedRoot = join(process.cwd(), 'packages/api-types/src/generated');

const digestDirectory = (dir) => {
  if (!existsSync(dir)) {
    return '';
  }

  const hash = createHash('sha256');

  const walk = (currentDir) => {
    const entries = readdirSync(currentDir).sort((a, b) => a.localeCompare(b));
    for (const entry of entries) {
      const absolutePath = join(currentDir, entry);
      const info = statSync(absolutePath);
      if (info.isDirectory()) {
        walk(absolutePath);
      } else {
        hash.update(absolutePath.replace(`${process.cwd()}/`, ''));
        hash.update(readFileSync(absolutePath));
      }
    }
  };

  walk(dir);
  return hash.digest('hex');
};

const before = digestDirectory(generatedRoot);
execSync('node scripts/codegen.mjs', { stdio: 'inherit' });
const after = digestDirectory(generatedRoot);

if (before !== after) {
  console.error('Generated artifacts are out of date. Run `pnpm codegen` and commit results.');
  process.exit(1);
}

console.log('Generated artifacts are up to date.');
