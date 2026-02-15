import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Editor } from '@/components/editor/Editor';

const { mockUseFileEditor } = vi.hoisted(() => ({
  mockUseFileEditor: vi.fn()
}));

vi.mock('@/hooks/use-file-editor', () => ({
  useFileEditor: mockUseFileEditor
}));

vi.mock('@devalbo/ui', () => ({
  useKeyboard: vi.fn()
}));

describe('Editor', () => {
  it('renders content and status bar', () => {
    mockUseFileEditor.mockReturnValue({
      content: 'hello',
      isDirty: true,
      isLoading: false,
      isBinary: false,
      fileExists: true,
      error: null,
      save: vi.fn(async () => undefined),
      revert: vi.fn(async () => undefined),
      createFile: vi.fn(async () => undefined),
      setContent: vi.fn()
    });

    const view = render(<Editor filePath="/tmp/a.txt" />);
    const text = view.lastFrame() ?? '';
    expect(text).toContain('Editor');
    expect(text).toContain('modified');
    expect(text).toContain('/tmp/a.txt');
  });

  it('renders binary file message', () => {
    mockUseFileEditor.mockReturnValue({
      content: '',
      isDirty: false,
      isLoading: false,
      isBinary: true,
      fileExists: true,
      error: null,
      save: vi.fn(async () => undefined),
      revert: vi.fn(async () => undefined),
      createFile: vi.fn(async () => undefined),
      setContent: vi.fn()
    });

    const view = render(<Editor filePath="/tmp/a.bin" />);
    expect(view.lastFrame()).toContain('Binary file detected');
  });
});
