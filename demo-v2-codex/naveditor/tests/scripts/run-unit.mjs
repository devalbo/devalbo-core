import { spawn } from 'node:child_process';

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

const withCoverage = process.argv.includes('--coverage');
const ts = timestamp();
const outputDir = `tests/results/unit/${ts}`;

await run('pnpm', ['vitest', 'run', ...(withCoverage ? ['--coverage'] : [])], { TEST_OUTPUT_DIR: outputDir });

if (!withCoverage) {
  await run('node', ['tests/scripts/generate-html-report.mjs', ts]);
}

await run('node', ['tests/scripts/copy-test-results.mjs', 'unit', ts]);
