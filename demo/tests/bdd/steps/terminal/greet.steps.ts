import { When, Then, Before, After } from '@cucumber/cucumber';
import { spawn } from 'child_process';
import { strict as assert } from 'assert';

/**
 * Terminal BDD Tests with Visible Output
 *
 * These tests use child_process.spawn with inherited stdio to show CLI output
 * in the terminal where tests run, while also capturing output for assertions.
 *
 * Note: In non-TTY mode (automated tests), the CLI uses default values instead
 * of prompting. For interactive testing, run: node dist/cli.js greet
 */

// World context for terminal tests
interface World {
  output: string;
  error?: string;
}

let world: World = { output: '' };

Before(function () {
  world = { output: '' };
});

After(function () {
  world = { output: '' };
});

/**
 * Run a CLI command with visible output
 */
async function runCommand(command: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');

    // Show the command being executed
    console.log(`\n$ ${command}`);

    // Use spawn to run the command
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '1' },
      // Don't use stdio: 'inherit' because we need to capture output
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Capture stdout and echo to console
    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(str); // Show in terminal
    });

    // Capture stderr and echo to console
    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(str); // Show in terminal
    });

    // Send input if provided (for interactive prompts)
    if (input !== undefined && child.stdin) {
      // Echo the input to terminal so it's visible
      process.stdout.write(`${input}\n`);
      child.stdin.write(input + '\n');
      child.stdin.end();
    } else if (child.stdin) {
      child.stdin.end();
    }

    child.on('close', (code) => {
      const output = stdout + stderr;

      // Strip ANSI codes for assertion
      const cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}\nOutput: ${cleanOutput}`));
      } else {
        resolve(cleanOutput);
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

When('I run the greet command without arguments', async function () {
  try {
    // Provide "World" as input for the interactive prompt
    world.output = await runCommand('node dist/cli.js greet', 'World');
  } catch (error: any) {
    world.error = error.message;
  }
});

When('I run the greet command with {string}', async function (name: string) {
  try {
    world.output = await runCommand(`node dist/cli.js greet ${name}`);
  } catch (error: any) {
    world.error = error.message;
  }
});

When('I run the help command', async function () {
  try {
    world.output = await runCommand('node dist/cli.js help');
  } catch (error: any) {
    world.error = error.message;
  }
});

Then('I should see {string}', function (expectedText: string) {
  assert.ok(
    world.output.includes(expectedText),
    `Expected output to contain "${expectedText}", but got:\n${world.output}`
  );
});
