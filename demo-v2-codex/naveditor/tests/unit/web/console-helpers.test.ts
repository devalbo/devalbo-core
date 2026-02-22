import { beforeEach, describe, expect, it } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import {
  bindCliRuntimeSource,
  cli,
  unbindCliRuntimeSource
} from '@/web/console-helpers';
import type { CommandRuntimeContext } from '@/lib/command-runtime';

const makeContext = (cwd: string): CommandRuntimeContext => ({
  store: createDevalboStore(),
  cwd,
  setCwd: () => undefined
});

describe('web/console-helpers', () => {
  beforeEach(() => {
    unbindCliRuntimeSource();
  });

  it('reports not ready before binding', () => {
    const status = cli.status();
    expect(status.ready).toBe(false);
  });

  it('throws from exec before binding', async () => {
    await expect(cli.exec('pwd')).rejects.toThrow('CLI not ready');
  });

  it('returns error result from execText before binding', async () => {
    await expect(cli.execText('pwd')).resolves.toEqual({
      text: '',
      error: expect.stringContaining('CLI not ready')
    });
  });

  it('executes through shared runtime after binding', async () => {
    bindCliRuntimeSource({
      getContext: () => makeContext('/workspace')
    });

    const result = await cli.exec('pwd');
    expect(result.error).toBeUndefined();

    const text = await cli.execText('pwd');
    expect(text.error).toBeNull();
    expect(text.text).toContain('/workspace');
  });

  it('throws for unknown commands in exec but not execText', async () => {
    bindCliRuntimeSource({
      getContext: () => makeContext('/workspace')
    });

    await expect(cli.exec('definitely-not-a-command')).rejects.toThrow('Command not found: definitely-not-a-command');
    await expect(cli.execText('definitely-not-a-command')).resolves.toEqual({
      text: '',
      error: 'Command not found: definitely-not-a-command'
    });
  });

  it('uses latest runtime context after rebinding', async () => {
    bindCliRuntimeSource({
      getContext: () => makeContext('/one')
    });
    expect((await cli.execText('pwd')).text).toContain('/one');

    bindCliRuntimeSource({
      getContext: () => makeContext('/two')
    });
    expect((await cli.execText('pwd')).text).toContain('/two');
  });
});
