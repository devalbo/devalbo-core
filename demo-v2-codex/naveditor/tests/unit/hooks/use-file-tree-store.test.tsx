import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { unsafeAsFilePath } from '@devalbo/shared';
import { FILE_TREE_TABLE } from '@devalbo/state';
import type { UseFileTreeReturn } from '@/hooks/use-file-tree';

const { mockUseFileTree } = vi.hoisted(() => ({
  mockUseFileTree: vi.fn()
}));

vi.mock('@/hooks/use-file-tree', () => ({
  useFileTree: mockUseFileTree
}));

import { useFileTreeStore } from '@/hooks/use-file-tree-store';

function HookHarness({ onChange }: { onChange: (value: ReturnType<typeof useFileTreeStore>) => void }) {
  const value = useFileTreeStore('/root');
  onChange(value);
  return null;
}

describe('useFileTreeStore', () => {
  beforeEach(() => {
    const value: UseFileTreeReturn = {
      entries: [{ name: 'a.txt', path: unsafeAsFilePath('/root/a.txt'), isDirectory: false }],
      selectedPath: '/root/a.txt',
      isLoading: false,
      error: null,
      select: vi.fn(),
      refresh: vi.fn(async () => undefined)
    };
    mockUseFileTree.mockReset().mockReturnValue(value);
  });

  it('populates tinybase rows from hook entries', async () => {
    let latest: ReturnType<typeof useFileTreeStore> | undefined;
    await act(async () => {
      create(<HookHarness onChange={(value) => (latest = value)} />);
      await Promise.resolve();
    });

    const row = latest?.store.getRow(FILE_TREE_TABLE, '/root/a.txt');
    expect(row?.name).toBe('a.txt');
    expect(row?.path).toBe('/root/a.txt');
  });
});
