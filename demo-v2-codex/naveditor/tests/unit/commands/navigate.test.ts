import { describe, expect, it } from 'vitest';
import { commands } from '@/commands';

describe('ls command', () => {
  it('returns component for valid directory', async () => {
    const result = await commands.ls(['.'], { cwd: process.cwd() });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('returns error for non-existent directory', async () => {
    const result = await commands.ls(['./missing-dir-xyz'], { cwd: process.cwd() });
    expect(result.component).toBeTruthy();
    expect(result.error).toBeTruthy();
  });
});
