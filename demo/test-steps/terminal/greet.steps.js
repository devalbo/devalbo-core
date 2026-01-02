import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { execSync } from 'child_process';
import { strict as assert } from 'assert';

// World context for terminal tests
let world = {};

Before(function () {
  world = { output: '' };
});

After(function () {
  world = { output: '' };
});

When('I run the greet command without arguments', function () {
  try {
    world.output = execSync('node dist/cli.js greet', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  } catch (error) {
    world.error = error.message;
    world.output = error.stdout || '';
  }
});

When('I run the greet command with {string}', function (name) {
  try {
    world.output = execSync(`node dist/cli.js greet ${name}`, {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  } catch (error) {
    world.error = error.message;
    world.output = error.stdout || '';
  }
});

When('I run the help command', function () {
  try {
    world.output = execSync('node dist/cli.js help', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  } catch (error) {
    world.error = error.message;
    world.output = error.stdout || '';
  }
});

Then('I should see {string}', function (expectedText) {
  assert.ok(
    world.output.includes(expectedText),
    `Expected output to contain "${expectedText}", but got:\n${world.output}`
  );
});
