import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { asFilePath } from '@devalbo/shared';
import { FileTreeItem } from '@/components/navigator/FileTreeItem';

describe('FileTreeItem', () => {
  it('renders file name and type icon', () => {
    const view = render(<FileTreeItem entry={{ name: 'index.ts', path: asFilePath('/index.ts'), isDirectory: false }} selected={false} />);
    const text = view.lastFrame() ?? '';
    expect(text).toContain('[TS]');
    expect(text).toContain('index.ts');
  });

  it('renders directory icon for directories', () => {
    const view = render(<FileTreeItem entry={{ name: 'src', path: asFilePath('/src'), isDirectory: true }} selected={true} />);
    const text = view.lastFrame() ?? '';
    expect(text).toContain('[DIR]');
    expect(text).toContain('src');
  });
});
