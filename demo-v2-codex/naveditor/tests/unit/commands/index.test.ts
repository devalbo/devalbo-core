import { describe, expect, it } from 'vitest';
import { commands } from '@/commands';
import { createDevalboStore } from '@devalbo/state';

describe('commands', () => {
  const store = createDevalboStore();

  it('returns help output', async () => {
    const result = await commands.help([], { store });
    expect(result.error).toBeUndefined();
    expect(result.component).toBeTruthy();
  });

  it('returns pwd output', async () => {
    const result = await commands.pwd([], { cwd: '/tmp', store });
    expect(result.component).toBeTruthy();
  });
});
