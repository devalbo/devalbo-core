import { describe, expect, it } from 'vitest';
import { commands } from '@/commands';
import { createDevalboStore } from '@devalbo/state';

describe('cat command', () => {
  const store = createDevalboStore();

  it('returns component for valid file', async () => {
    const result = await commands.cat(['./tests/fixtures/sample-files/hello.txt'], { cwd: process.cwd(), store });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('returns error for non-existent file', async () => {
    const result = await commands.cat(['./tests/fixtures/sample-files/not-found-create.txt'], { cwd: process.cwd(), store });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeTruthy();
  });
});
