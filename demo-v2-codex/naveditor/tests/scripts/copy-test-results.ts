import fs from 'node:fs/promises';
import path from 'node:path';

async function copyDir(src: string, dst: string) {
  await fs.rm(dst, { recursive: true, force: true });
  await fs.mkdir(dst, { recursive: true });

  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath);
    } else {
      await fs.copyFile(srcPath, dstPath);
    }
  }
}

const [group, timestamp] = process.argv.slice(2);
if (!group || !timestamp) {
  console.error('Usage: tsx tests/scripts/copy-test-results.ts <group> <timestamp>');
  process.exit(1);
}

const base = path.resolve('tests/results', group);
await copyDir(path.join(base, timestamp), path.join(base, 'latest'));
console.log(`Copied ${group}/${timestamp} to latest`);
