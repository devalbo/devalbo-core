import fs from 'node:fs/promises';
import path from 'node:path';

const [timestamp] = process.argv.slice(2);
if (!timestamp) {
  console.error('Usage: node tests/scripts/generate-html-report.mjs <timestamp>');
  process.exit(1);
}

const outputDir = path.resolve('tests/results/unit', timestamp);
const jsonPath = path.join(outputDir, 'results.json');
const htmlPath = path.join(outputDir, 'report.html');

const raw = await fs.readFile(jsonPath, 'utf8').catch(() => '{}');
const data = JSON.parse(raw);

const html = `<!doctype html>
<html>
  <body>
    <h1>naveditor unit test report</h1>
    <p>Passed: ${data.numPassedTests ?? 0}</p>
    <p>Failed: ${data.numFailedTests ?? 0}</p>
  </body>
</html>`;

await fs.writeFile(htmlPath, html, 'utf8');
console.log(`Wrote ${htmlPath}`);
