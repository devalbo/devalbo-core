#!/usr/bin/env node
import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const testsRoot = join(projectRoot, 'tests');

// Get arguments: test type and timestamp
const [testType, timestamp] = process.argv.slice(2);

if (!testType || !timestamp) {
  console.error('Usage: copy-test-results.ts <test-type> <timestamp>');
  process.exit(1);
}

const sourceDir = join(testsRoot, 'results', testType, timestamp);
const latestDir = join(testsRoot, 'results', testType, 'latest');

try {
  // Ensure source exists
  mkdirSync(sourceDir, { recursive: true });

  // Copy to latest (remove and recreate to ensure clean copy)
  cpSync(sourceDir, latestDir, { recursive: true, force: true });

  console.log(`Copied ${sourceDir} to ${latestDir}`);
} catch (error) {
  console.error('Error copying test results:', error);
  process.exit(1);
}

