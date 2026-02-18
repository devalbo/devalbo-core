import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commands } from '@/commands';
import { createDevalboStore } from '@devalbo/state';

const FIXTURES = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../fixtures');

describe('cat command', () => {
  const store = createDevalboStore();

  it('returns component for valid file', async () => {
    const result = await commands.cat([path.join(FIXTURES, 'sample-files/hello.txt')], { cwd: process.cwd(), store });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('returns error for non-existent file', async () => {
    const result = await commands.cat([path.join(FIXTURES, 'sample-files/not-found-create.txt')], { cwd: process.cwd(), store });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeTruthy();
  });
});
