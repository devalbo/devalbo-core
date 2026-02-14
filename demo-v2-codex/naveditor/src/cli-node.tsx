#!/usr/bin/env node
import { setupCLI } from './cli';

setupCLI().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
