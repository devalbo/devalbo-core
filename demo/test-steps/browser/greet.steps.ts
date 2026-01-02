import { When, Then, Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { strict as assert } from 'assert';

// World context for browser tests
interface World {
  output: string;
  page?: Page;
}

let world: World = { output: '' };
let sharedBrowser: Browser | null = null;
let sharedContext: BrowserContext | null = null;
let oldPage: Page | null = null;

// Increase timeout for browser operations
setDefaultTimeout(30000);

BeforeAll(async function () {
  // Launch browser and create a single context (window)
  sharedBrowser = await chromium.launch({ headless: false });
  sharedContext = await sharedBrowser.newContext();
});

AfterAll(async function () {
  // Close context and browser after all tests
  if (sharedContext) await sharedContext.close();
  if (sharedBrowser) await sharedBrowser.close();
});

Before(async function () {
  world = { output: '' };

  // Create new page/tab in the same context (window)
  const newPage = await sharedContext.newPage();

  // Close old page after new one is created but before navigating
  if (oldPage) {
    await oldPage.close();
  }

  world.page = newPage;
  oldPage = newPage;

  // Navigate to the app
  await world.page.goto('http://localhost:3000');

  // Wait for the terminal to be ready
  await world.page.waitForSelector('.xterm', { timeout: 10000 });
});

After(async function () {
  // Don't close the page here - will be closed before next test
  // or at the end in AfterAll
});

async function typeCommand(command: string) {
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

When('I run the greet command with {string}', async function (name: string) {
  await typeCommand(`greet ${name}`);
});

When('I run the help command', async function () {
  await typeCommand('help');
});

Then('I should see {string}', function (expectedText: string) {
  assert.ok(
    world.output.includes(expectedText),
    `Expected output to contain "${expectedText}", but got:\n${world.output}`
  );
});
