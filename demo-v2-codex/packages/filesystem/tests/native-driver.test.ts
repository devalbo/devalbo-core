import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asDirectoryPath, asFilePath } from '@devalbo/shared';
import { NativeFSDriver } from '../src/drivers/native';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('NativeFSDriver', () => {
  it('reads and lists files from temp directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'devalbo-fs-'));
    dirs.push(root);

    const file = path.join(root, 'a.txt');
    await writeFile(file, 'abc', 'utf8');

    const driver = new NativeFSDriver();
    const data = await driver.readFile(asFilePath(file));
    expect(new TextDecoder().decode(data)).toBe('abc');

    const entries = await driver.readdir(asDirectoryPath(root));
    expect(entries.some((entry) => entry.name === 'a.txt')).toBe(true);
  });
});
