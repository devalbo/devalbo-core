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

When('I run the help command', async function () {
  const { pageA } = getPages();
  await runCommand(pageA, 'help');
});

Then('I should see {string}', async function (expected: string) {
  const { pageA } = getPages();
  await pageA.waitForFunction(async (value) => {
    const cli = (window as unknown as { cli?: { helpText?: () => Promise<string> } }).cli;
    if (!cli?.helpText) return false;
    const text = await cli.helpText();
    return text.includes(value);
  }, expected);
  const text = await pageA.evaluate(async () => {
    const cli = (window as unknown as { cli?: { helpText?: () => Promise<string> } }).cli;
    if (!cli?.helpText) return '';
    return cli.helpText();
  });
  assert.ok(text.includes(expected));
});
