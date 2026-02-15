import { When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import type { Page } from '@playwright/test';

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

When('I run the navigate command without arguments', async function () {
  const { pageA } = getPages();
  await runCommand(pageA, 'navigate .');
});

Then('I should see a list of files in the current directory', async function () {
  const { pageA } = getPages();
  await pageA.waitForFunction(() => document.body.innerText.includes('README.md'));
  const text = (await pageA.textContent('body')) ?? '';
  assert.ok(text.includes('README.md'));
});
