import { describe, expect, it, vi } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import {
  executeCommand,
  executeCommandRaw,
  parseCommandLine,
  type CommandRuntimeContext
} from '@/lib/command-runtime';

const extractText = (node: unknown): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return props?.children ? extractText(props.children) : '';
  }
  return '';
};

describe('command-runtime', () => {
  it('parses command + args using formal parser', () => {
    expect(parseCommandLine('ls /')).toEqual({ commandName: 'ls', args: ['/'] });
  });

  it('returns no-op result for blank raw command', async () => {
    const ctx: CommandRuntimeContext = {
      store: createDevalboStore(),
      cwd: '/',
      setCwd: vi.fn()
    };

    const result = await executeCommandRaw('', ctx);
    expect(result.error).toBeUndefined();
    expect(extractText(result.component)).toBe('');
  });

  it('returns unknown command result without throwing', async () => {
    const ctx: CommandRuntimeContext = {
      store: createDevalboStore(),
      cwd: '/',
      setCwd: vi.fn()
    };

    const result = await executeCommandRaw('definitely-not-a-command', ctx);
    expect(result.error).toBe('Command not found: definitely-not-a-command');
  });

  it('forwards options built from context to commands', async () => {
    const setCwd = vi.fn();
    const ctx: CommandRuntimeContext = {
      store: createDevalboStore(),
      cwd: '/tmp',
      setCwd
    };

    const pwd = await executeCommand('pwd', [], ctx);
    expect(extractText(pwd.component)).toContain('/tmp');

    await executeCommand('cd', ['/'], ctx);
    expect(setCwd).toHaveBeenCalledWith('/');
  });
});
