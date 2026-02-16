import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { unsafeAsFilePath } from '@devalbo/shared';
import { FileTree } from '@/components/navigator/FileTree';

vi.mock('@devalbo/ui', () => ({
  useKeyboard: vi.fn()
}));

describe('FileTree', () => {
  it('renders empty state message', () => {
    const view = render(<FileTree entries={[]} selectedPath={null} isLoading={false} error={null} onSelect={vi.fn()} />);
    expect(view.lastFrame()).toContain('Directory is empty');
  });

  it('renders file entries', () => {
    const view = render(
      <FileTree
        entries={[{ name: 'a.txt', path: unsafeAsFilePath('/a.txt'), isDirectory: false }]}
        selectedPath={null}
        isLoading={false}
        error={null}
        onSelect={vi.fn()}
      />
    );
    expect(view.lastFrame()).toContain('a.txt');
  });
});
