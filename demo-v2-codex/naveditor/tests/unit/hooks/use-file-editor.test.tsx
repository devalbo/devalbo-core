import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import type { UseFileEditorReturn } from '@/hooks/use-file-editor';

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('@/lib/file-operations', () => ({
  getDriver: vi.fn(async () => ({ readFile: mockReadFile, writeFile: mockWriteFile }))
}));

import { useFileEditor } from '@/hooks/use-file-editor';

function HookHarness({ filePath, onChange }: { filePath: string; onChange: (value: UseFileEditorReturn) => void }) {
  const value = useFileEditor(filePath);
  onChange(value);
  return null;
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useFileEditor', () => {
  beforeEach(() => {
    mockReadFile.mockReset().mockResolvedValue(new TextEncoder().encode('hello'));
    mockWriteFile.mockReset().mockResolvedValue(undefined);
  });

  it('loads content on mount', async () => {
    let latest: UseFileEditorReturn | undefined;
    await act(async () => {
      create(<HookHarness filePath="/tmp/a.txt" onChange={(value) => (latest = value)} />);
      await flush();
    });

    expect(latest?.isLoading).toBe(false);
    expect(latest?.content).toBe('hello');
    expect(latest?.isDirty).toBe(false);
  });

  it('setContent marks buffer dirty and save persists', async () => {
    let latest: UseFileEditorReturn | undefined;
    await act(async () => {
      create(<HookHarness filePath="/tmp/a.txt" onChange={(value) => (latest = value)} />);
      await flush();
    });

    await act(async () => {
      latest?.setContent('changed');
      await flush();
    });

    expect(latest?.isDirty).toBe(true);

    await act(async () => {
      await latest?.save();
      await flush();
    });

    expect(mockWriteFile).toHaveBeenCalled();
    expect(latest?.isDirty).toBe(false);
  });

  it('sets not-found state when read fails', async () => {
    mockReadFile.mockResolvedValueOnce(Promise.reject(new Error('File not found: missing')));
    let latest: UseFileEditorReturn | undefined;

    await act(async () => {
      create(<HookHarness filePath="/tmp/missing.txt" onChange={(value) => (latest = value)} />);
      await flush();
    });

    expect(latest?.fileExists).toBe(false);
  });
});
