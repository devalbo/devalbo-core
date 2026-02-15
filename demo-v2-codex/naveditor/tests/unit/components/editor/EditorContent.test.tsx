import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { EditorContent } from '@/components/editor/EditorContent';

describe('EditorContent', () => {
  it('renders file content text', () => {
    const view = render(<EditorContent content={'line1\nline2'} />);
    const text = view.lastFrame() ?? '';
    expect(text).toContain('line1');
    expect(text).toContain('line2');
  });

  it('renders a blank line placeholder for empty content', () => {
    const view = render(<EditorContent content={''} />);
    const text = view.lastFrame() ?? '';
    expect(text).toContain('1');
  });
});
