import { describe, expect, it } from 'vitest';
import { commands } from '@/commands';
import { createDevalboStore } from '@devalbo/state';

describe('ls command', () => {
  const store = createDevalboStore();

  it('returns component for valid directory', async () => {
    const result = await commands.ls(['.'], { cwd: process.cwd(), store });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('returns error for non-existent directory', async () => {
    const result = await commands.ls(['./missing-dir-xyz'], { cwd: process.cwd(), store });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeTruthy();
  });
});
