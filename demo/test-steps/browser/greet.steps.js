import { When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { strict as assert } from 'assert';

// World context for browser tests
let world = {};

// Increase timeout for browser operations
setDefaultTimeout(30000);

Before(async function () {
  world = { output: '' };
  world.browser = await chromium.launch({ headless: false });
  world.page = await world.browser.newPage();

  // Navigate to the app
  await world.page.goto('http://localhost:3000');

  // Wait for the terminal to be ready
  await world.page.waitForSelector('.xterm', { timeout: 10000 });
});

After(async function () {
  if (world.page) await world.page.close();
  if (world.browser) await world.browser.close();
});

async function typeCommand(command) {
  if (!world.page) throw new Error('Page not initialized');

  // Get initial output to compare against
  const initialOutput = await world.page.evaluate(() => {
    const terminal = document.querySelector('#cli-terminal .xterm-screen');
    return terminal ? (terminal.innerText || terminal.textContent || '') : '';
  });

  // Click on the terminal to focus it
  await world.page.click('#cli-terminal');
  await world.page.waitForTimeout(300);

  // Type the command into the terminal
  await world.page.keyboard.type(command, { delay: 50 });
  await world.page.keyboard.press('Enter');

  // Wait for output to change (with timeout)
  let attempts = 0;
  let outputChanged = false;
  while (attempts < 20 && !outputChanged) {
    await world.page.waitForTimeout(200);
    const currentOutput = await world.page.evaluate(() => {
      const terminal = document.querySelector('#cli-terminal .xterm-screen');
      return terminal ? (terminal.innerText || terminal.textContent || '') : '';
    });
    outputChanged = currentOutput !== initialOutput && currentOutput.includes(command);
    attempts++;
  }

  // Get the final terminal output
  world.output = await world.page.evaluate(() => {
    const terminal = document.querySelector('#cli-terminal .xterm-screen');
    if (!terminal) return '';
    return terminal.innerText || terminal.textContent || '';
  });
}

When('I run the greet command without arguments', async function () {
  await typeCommand('greet');
});

When('I run the greet command with {string}', async function (name) {
  await typeCommand(`greet ${name}`);
});

When('I run the help command', async function () {
  await typeCommand('help');
});

Then('I should see {string}', function (expectedText) {
  assert.ok(
    world.output.includes(expectedText),
    `Expected output to contain "${expectedText}", but got:\n${world.output}`
  );
});
