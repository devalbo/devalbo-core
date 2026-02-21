import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import { commands } from '@/commands';

const extractText = (node: ReactNode): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
};

describe('files commands', () => {
  it('files-root-add with no args errors with usage message', async () => {
    const store = createDevalboStore();
    const result = await commands['files-root-add']([], { store });
    expect(result.error).toContain('Usage: files-root-add');
  });

  it('files-root-add with localPath not ending in slash errors', async () => {
    const store = createDevalboStore();
    const result = await commands['files-root-add'](['/work', 'https://example.com/files/'], { store });
    expect(result.error).toContain('must end with "/"');
  });

  it('files-root-remove with one arg errors', async () => {
    const store = createDevalboStore();
    const result = await commands['files-root-remove'](['root-id'], { store });
    expect(result.error).toContain('Usage: files-root-remove');
  });

  it('files-root-remove with invalid mode errors', async () => {
    const store = createDevalboStore();
    const result = await commands['files-root-remove'](['root-id', 'nope'], { store });
    expect(result.error).toContain('keep-pod or delete-from-pod');
  });

  it('files-resolve with no args errors', async () => {
    const store = createDevalboStore();
    const result = await commands['files-resolve']([], { store });
    expect(result.error).toContain('Not logged in');
  });

  it('files-resolve with invalid resolution arg errors', async () => {
    const store = createDevalboStore();
    const session = { isAuthenticated: true as const, webId: 'https://alice.example/profile#me', fetch: globalThis.fetch };
    const driver = {
      readFile: async () => new Uint8Array(),
      writeFile: async () => undefined,
      readdir: async () => [],
      stat: async () => ({ name: 'x', path: '/x', isDirectory: false }),
      mkdir: async () => undefined,
      rm: async () => undefined,
      exists: async () => false
    };
    const result = await commands['files-resolve'](['/tmp/a.txt', 'invalid'], { store, session, driver });
    expect(result.error).toContain('Resolution must be');
  });

  it('files-root-list with empty store renders empty message', async () => {
    const store = createDevalboStore();
    const result = await commands['files-root-list']([], { store });
    expect(result.error).toBeUndefined();
    expect(extractText(result.component)).toContain('No sync roots configured');
  });
});
