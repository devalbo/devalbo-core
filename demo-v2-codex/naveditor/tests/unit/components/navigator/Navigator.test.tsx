import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { asFilePath } from '@devalbo/shared';
import { createDevalboStore, FILE_TREE_TABLE } from '@devalbo/state';
import { Navigator } from '@/components/navigator/Navigator';

const { mockUseFileTreeStore } = vi.hoisted(() => ({
  mockUseFileTreeStore: vi.fn()
}));

vi.mock('@/hooks/use-file-tree-store', () => ({
  useFileTreeStore: mockUseFileTreeStore
}));

vi.mock('@devalbo/ui', () => ({
  useKeyboard: vi.fn()
}));

describe('Navigator', () => {
  it('renders tree and status details', () => {
    const store = createDevalboStore();
    store.setRow(FILE_TREE_TABLE, '/root/a.txt', {
      path: '/root/a.txt',
      name: 'a.txt',
      parentPath: '/root',
      isDirectory: false,
      size: 1,
      mtime: ''
    });

    mockUseFileTreeStore.mockReturnValue({
      store,
      tree: {
        entries: [{ name: 'a.txt', path: asFilePath('/root/a.txt'), isDirectory: false }],
        selectedPath: '/root/a.txt',
        isLoading: false,
        error: null,
        select: vi.fn(),
        refresh: vi.fn(async () => undefined)
      }
    });

    const view = render(<Navigator rootPath="/root" />);
    const text = view.lastFrame() ?? '';
    expect(text).toContain('Navigator');
    expect(text).toContain('entries: 1');
  });
});
