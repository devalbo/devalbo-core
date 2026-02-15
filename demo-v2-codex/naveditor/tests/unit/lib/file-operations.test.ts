import { describe, expect, it } from 'vitest';
import { asFilePath } from '@devalbo/shared';
import { getDriver } from '@/lib/file-operations';

describe('file-operations', () => {
  it('provides a readable driver in node runtime', async () => {
    const driver = await getDriver();
    const bytes = await driver.readFile(asFilePath('./tests/fixtures/sample-files/hello.txt'));
    expect(new TextDecoder().decode(bytes)).toContain('Hello');
  });

  it('writes and reads back through driver', async () => {
    const driver = await getDriver();
    const tempPath = asFilePath('./tests/fixtures/sample-files/tmp-write.txt');

    await driver.writeFile(tempPath, new TextEncoder().encode('abc'));
    const bytes = await driver.readFile(tempPath);

    expect(new TextDecoder().decode(bytes)).toBe('abc');

    await driver.rm(tempPath);
  });
});
