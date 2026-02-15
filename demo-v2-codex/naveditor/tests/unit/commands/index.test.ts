import { describe, expect, it } from 'vitest';
import { commands } from '@/commands';

describe('commands', () => {
  it('returns help output', async () => {
    const result = await commands.help([]);
    expect(result.error).toBeUndefined();
    expect(result.component).toBeTruthy();
  });

  it('returns pwd output', async () => {
    const result = await commands.pwd([], { cwd: '/tmp' });
    expect(result.component).toBeTruthy();
  });
});
