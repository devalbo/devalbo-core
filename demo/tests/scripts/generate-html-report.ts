#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const testsRoot = join(projectRoot, 'tests');

interface TestResults {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  startTime?: number;
  testResults?: Array<{
    name: string;
    assertionResults?: Array<{
      title: string;
      status: 'passed' | 'failed' | 'skipped';
      duration?: number;
    }>;
    perfStats?: {
      runtime?: number;
    };
  }>;
}

interface Stats {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
}

// Get timestamp from argument or use 'latest'
const timestampArg = process.argv[2] || 'latest';
const testDir = join(testsRoot, 'results', 'unit', timestampArg);

// Read JSON test results
const jsonPath = join(testDir, 'results.json');
const data: TestResults = JSON.parse(readFileSync(jsonPath, 'utf-8'));

// Calculate stats
const stats: Stats = {
  passed: data.numPassedTests || 0,
  failed: data.numFailedTests || 0,
  skipped: data.numPendingTests || 0,
  total: data.numTotalTests || 0,
  duration: (data.testResults?.reduce((acc, file) => acc + (file.perfStats?.runtime || 0), 0) || 0) / 1000
};

// Format timestamp
const formattedTimestamp = data.startTime 
  ? new Date(data.startTime).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  : 'Unknown';

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vitest Test Results</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 20px; color: #333; }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .summary-item.passed { background: #d4edda; color: #155724; }
    .summary-item.failed { background: #f8d7da; color: #721c24; }
    .summary-item.skipped { background: #fff3cd; color: #856404; }
    .summary-item.total { background: #d1ecf1; color: #0c5460; }
    .summary-value { font-size: 32px; font-weight: bold; display: block; }
    .summary-label { font-size: 14px; margin-top: 5px; }
    .test-list {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-file {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .test-file:last-child { border-bottom: none; }
    .test-file-name {
      font-weight: bold;
      margin-bottom: 10px;
      color: #333;
    }
    .test-item {
      padding: 10px 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      border-left: 3px solid transparent;
      margin: 5px 0;
    }
    .test-item.pass { border-left-color: #28a745; background: #f8fff9; }
    .test-item.fail { border-left-color: #dc3545; background: #fff5f5; }
    .test-item.skip { border-left-color: #ffc107; background: #fffef5; }
    .test-status {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .test-status.pass { background: #28a745; }
    .test-status.fail { background: #dc3545; }
    .test-status.skip { background: #ffc107; }
    .test-name { flex: 1; }
    .test-duration { color: #999; font-size: 12px; }
    .timestamp {
      color: #666;
      font-size: 14px;
      font-weight: normal;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Vitest Test Results</h1>
    <div class="timestamp">Generated: ${formattedTimestamp}</div>

    <div class="summary">
      <div><strong>Duration:</strong> ${stats.duration.toFixed(2)}s</div>
      <div class="summary-grid">
        <div class="summary-item total">
          <span class="summary-value">${stats.total}</span>
          <span class="summary-label">Total Tests</span>
        </div>
        <div class="summary-item passed">
          <span class="summary-value">${stats.passed}</span>
          <span class="summary-label">Passed</span>
        </div>
        <div class="summary-item failed">
          <span class="summary-value">${stats.failed}</span>
          <span class="summary-label">Failed</span>
        </div>
        <div class="summary-item skipped">
          <span class="summary-value">${stats.skipped}</span>
          <span class="summary-label">Skipped</span>
        </div>
      </div>
    </div>

    <div class="test-list">
      <h2 style="margin-bottom: 15px;">Test Details</h2>
      ${(data.testResults || []).map(file => `
        <div class="test-file">
          <div class="test-file-name">${file.name}</div>
          ${(file.assertionResults || []).map(test => `
            <div class="test-item ${test.status}">
              <div class="test-status ${test.status}"></div>
              <div class="test-name">${test.title}</div>
              <div class="test-duration">${((test.duration || 0) / 1000).toFixed(3)}s</div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

// Write HTML report
const outputPath = join(testDir, 'report.html');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log('HTML report written to:', outputPath);

