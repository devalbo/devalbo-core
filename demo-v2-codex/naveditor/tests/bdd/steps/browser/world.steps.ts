import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

let browser: Browser | undefined;
let context: BrowserContext | undefined;
let pageA: Page | undefined;
let pageB: Page | undefined;

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

setDefaultTimeout(30_000);

BeforeAll(async () => {
  const headless = process.env.PW_HEADLESS === '1';
  const slowMoEnv = Number(process.env.PW_SLOWMO ?? '');
  const slowMo = Number.isFinite(slowMoEnv) && slowMoEnv >= 0 ? slowMoEnv : headless ? 0 : 3000;
  browser = await chromium.launch({ headless, slowMo });
});

AfterAll(async () => {
  await browser?.close();
  browser = undefined;
});

Before(async () => {
  if (!browser) {
    throw new Error('Browser is not initialized');
  }

  context = await browser.newContext();
  pageA = await context.newPage();
  pageB = await context.newPage();

  await Promise.all([pageA.goto(baseUrl), pageB.goto(baseUrl)]);
  await Promise.all([
    pageA.waitForFunction(() => Boolean((window as unknown as { cli?: unknown }).cli)),
    pageB.waitForFunction(() => Boolean((window as unknown as { cli?: unknown }).cli))
  ]);

  (globalThis as { __navPages?: { pageA: Page; pageB: Page } }).__navPages = { pageA, pageB };
});

After(async () => {
  await context?.close();
  context = undefined;
  pageA = undefined;
  pageB = undefined;
  delete (globalThis as { __navPages?: { pageA: Page; pageB: Page } }).__navPages;
});
