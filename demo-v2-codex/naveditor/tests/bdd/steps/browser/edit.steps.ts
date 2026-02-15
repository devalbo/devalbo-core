import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import type { Page } from '@playwright/test';

let filePath = '';
const runCommand = async (page: Page, command: string) => {
  await page.bringToFront();
  await page.click('body');
  await page.keyboard.type(command);
  await page.keyboard.press('Enter');
};

const getPages = (): { pageA: Page; pageB: Page } => {
  const pages = (globalThis as { __navPages?: { pageA: Page; pageB: Page } }).__navPages;
  if (!pages) throw new Error('Browser pages are not initialized');
  return pages;
};

When('I run the edit command with {string}', async function (file: string) {
  filePath = file;
  const { pageA } = getPages();

  await runCommand(pageA, `edit ${filePath}`);
});

Then('I should see the contents of {string}', async function (_name: string) {
  const { pageB } = getPages();
  await runCommand(pageB, `edit ${filePath}`);
  await pageB.waitForFunction(() => document.body.innerText.includes('Hello, World!'));
  const text = (await pageB.textContent('body')) ?? '';
  assert.ok(text.includes('Hello, World!'));
});
