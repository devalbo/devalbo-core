#!/usr/bin/env node
// Node.js CLI entry point
import { setupCLI } from './cli';

setupCLI().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
