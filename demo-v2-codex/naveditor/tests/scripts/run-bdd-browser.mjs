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

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // keep retrying until timeout
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`preview server timeout at ${url}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }
}

const headless = process.argv.includes('--headless');
const slowMoArg = process.argv.find((arg) => arg.startsWith('--slowmo='));
const slowMo = slowMoArg ? Number(slowMoArg.split('=')[1]) : headless ? 300 : 3000;
const ts = timestamp();
const base = `tests/results/bdd/browser/${ts}`;
const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

await run('pnpm', ['build:web']);

const preview = spawn('pnpm', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  stdio: 'inherit',
  env: process.env
});

try {
  await waitForServer(baseUrl);

  await run(
    'cucumber-js',
    [
      'tests/bdd/features',
      '--import',
      'tests/bdd/steps/browser/*.steps.ts',
      '--format',
      'progress',
      '--format',
      `json:${base}/cucumber-report.json`,
      '--format',
      `html:${base}/cucumber-report.html`
    ],
    {
      E2E_BASE_URL: baseUrl,
      PW_HEADLESS: headless ? '1' : '0',
      PW_SLOWMO: String(slowMo)
    }
  );

  await run('node', ['tests/scripts/copy-test-results.mjs', 'bdd/browser', ts]);
} finally {
  preview.kill('SIGTERM');
}
