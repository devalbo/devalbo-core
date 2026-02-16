import { describe, expect, it } from 'vitest';
import { TextDecoder, TextEncoder } from 'node:util';
import { unsafeAsDirectoryPath, unsafeAsFilePath } from '@devalbo/shared';
import { InMemoryDriver } from '../src/drivers/memory';

describe('InMemoryDriver', () => {
  it('writes and reads files', async () => {
    const driver = new InMemoryDriver();
    const file = unsafeAsFilePath('/tmp/hello.txt');

    await driver.writeFile(file, new TextEncoder().encode('hello'));
    const output = await driver.readFile(file);

    expect(new TextDecoder().decode(output)).toBe('hello');
  });

  it('supports stat and exists', async () => {
    const driver = new InMemoryDriver({ '/tmp/a.txt': 'a' });
    const file = unsafeAsFilePath('/tmp/a.txt');

    expect(await driver.exists(file)).toBe(true);
    const stat = await driver.stat(file);
    expect(stat.isDirectory).toBe(false);
    expect(stat.name).toBe('a.txt');
  });

  it('lists direct children via readdir', async () => {
    const driver = new InMemoryDriver({
      '/tmp/a.txt': 'a',
      '/tmp/nested/b.txt': 'b'
    });

    await driver.mkdir(unsafeAsDirectoryPath('/tmp'));
    await driver.mkdir(unsafeAsDirectoryPath('/tmp/nested'));

    const entries = await driver.readdir(unsafeAsDirectoryPath('/tmp'));
    const names = entries.map((entry) => entry.name).sort();

    expect(names).toEqual(['a.txt', 'nested']);
  });
});
