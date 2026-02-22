import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { unsafeAsFilePath } from '@devalbo/shared';
import type { UseFileTreeReturn } from '@/hooks/use-file-tree';

const mockReaddir = vi.fn();
const mockWatch = vi.fn();
const mockUnwatch = vi.fn();

vi.mock('@devalbo/cli-shell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@devalbo/cli-shell')>();
  return {
    ...actual,
  getDriver: vi.fn(async () => ({ readdir: mockReaddir })),
  getWatcher: vi.fn(async () => ({ watch: mockWatch }))
  };
});

import { useFileTree } from '@/hooks/use-file-tree';

function HookHarness({ onChange }: { onChange: (value: UseFileTreeReturn) => void }) {
  const value = useFileTree({ rootPath: '.' });
  onChange(value);
  return null;
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useFileTree', () => {
  beforeEach(() => {
    mockUnwatch.mockReset();
    mockWatch.mockReset().mockReturnValue(mockUnwatch);
    mockReaddir.mockReset().mockResolvedValue([
      { name: 'b.txt', path: unsafeAsFilePath('/b.txt'), isDirectory: false },
      { name: 'a', path: unsafeAsFilePath('/a'), isDirectory: true }
    ]);
  });

  it('loads and sorts entries on mount', async () => {
    let latest: UseFileTreeReturn | undefined;
    await act(async () => {
      create(<HookHarness onChange={(value) => (latest = value)} />);
      await flush();
    });

    expect(latest?.isLoading).toBe(false);
    expect(latest?.entries.map((entry) => entry.name)).toEqual(['a', 'b.txt']);
    expect(latest?.selectedPath).toBe('/a');
    expect(mockWatch).toHaveBeenCalled();
  });

  it('updates selected path when select is called', async () => {
    let latest: UseFileTreeReturn | undefined;
    await act(async () => {
      create(<HookHarness onChange={(value) => (latest = value)} />);
      await flush();
    });

    await act(async () => {
      latest?.select('/b.txt');
      await flush();
    });

    expect(latest?.selectedPath).toBe('/b.txt');
  });

  it('refresh updates entries', async () => {
    let latest: UseFileTreeReturn | undefined;
    await act(async () => {
      create(<HookHarness onChange={(value) => (latest = value)} />);
      await flush();
    });

    mockReaddir.mockResolvedValueOnce([{ name: 'new.txt', path: unsafeAsFilePath('/new.txt'), isDirectory: false }]);

    await act(async () => {
      await latest?.refresh();
      await flush();
    });

    expect(latest?.entries.map((entry) => entry.name)).toEqual(['new.txt']);
  });
});
