import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Text } from 'ink';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createDevalboStore } from '@devalbo/state';
import { InteractiveShell } from '@devalbo/cli-shell';
import * as commandRuntime from '@devalbo/cli-shell/lib/command-runtime';

const findSubmit = (renderer: ReactTestRenderer): ((raw: string) => Promise<void>) => {
  const input = renderer.root.find((node) => typeof node.props?.onSubmit === 'function');
  return input.props.onSubmit as (raw: string) => Promise<void>;
};

describe('InteractiveShell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits through shared runtime executeCommandRaw', async () => {
    const executeSpy = vi.spyOn(commandRuntime, 'executeCommandRaw').mockResolvedValue({
      component: <Text>mock output</Text>
    });
    const setCwd = vi.fn();
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <InteractiveShell
          runtime="browser"
          commands={{}}
          store={createDevalboStore()}
          driver={null}
          cwd="/"
          setCwd={setCwd}
        />
      );
    });

    const onSubmit = findSubmit(renderer);
    await act(async () => {
      await onSubmit('pwd');
    });

    expect(executeSpy).toHaveBeenCalledWith(
      'pwd',
      expect.objectContaining({
        commands: {},
        cwd: '/',
        setCwd,
        store: expect.any(Object)
      })
    );
  });

  it('records command and output in history', async () => {
    vi.spyOn(commandRuntime, 'executeCommandRaw').mockResolvedValue({
      component: <Text>mock output</Text>
    });
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <InteractiveShell
          runtime="browser"
          commands={{}}
          store={createDevalboStore()}
          driver={null}
          cwd="/"
          setCwd={() => undefined}
        />
      );
    });

    const onSubmit = findSubmit(renderer);
    await act(async () => {
      await onSubmit('pwd');
    });

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('$ pwd');
    expect(tree).toContain('mock output');
  });
});
