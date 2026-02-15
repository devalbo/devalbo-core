import React, { useEffect, useMemo, useState } from 'react';
import type { FilePreviewProps } from './types';

const coerceBytes = (content: string | Uint8Array): Uint8Array =>
  typeof content === 'string' ? new TextEncoder().encode(content) : content;

export const ImageFilePreview: React.FC<FilePreviewProps> = ({ content, mimeType, path }) => {
  const bytes = useMemo(() => coerceBytes(content), [content]);
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes, mimeType]);

  if (!url) return <div style={{ color: '#94a3b8' }}>Loading preview...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <img src={url} alt={path} style={{ maxWidth: '100%', maxHeight: '560px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #334155' }} />
      <div style={{ color: '#94a3b8', fontSize: '12px' }}>{mimeType}</div>
    </div>
  );
};
