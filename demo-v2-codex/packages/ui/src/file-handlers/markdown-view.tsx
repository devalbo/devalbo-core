import React, { useMemo } from 'react';
import type { FilePreviewProps } from './types';
import { renderMarkdownHtml, toMarkdownText } from './markdown-utils';

const previewStyle: React.CSSProperties = {
  background: '#020617',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px',
  color: '#e2e8f0',
  lineHeight: 1.6
};

export const MarkdownView: React.FC<FilePreviewProps> = ({ content }) => {
  const markdown = useMemo(() => toMarkdownText(content), [content]);
  const html = useMemo(() => renderMarkdownHtml(markdown), [markdown]);

  return (
    <div style={previewStyle}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};
