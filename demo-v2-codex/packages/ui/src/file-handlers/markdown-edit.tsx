import React, { useEffect, useMemo, useState } from 'react';
import type { FileEditProps } from './types';
import { toMarkdownText } from './markdown-utils';

export const MarkdownEdit: React.FC<FileEditProps> = ({ content, onSave, onChange }) => {
  const incoming = useMemo(() => toMarkdownText(content), [content]);
  const [baseline, setBaseline] = useState(incoming);
  const [draft, setDraft] = useState(incoming);
  const [isSaving, setIsSaving] = useState(false);
  const dirty = draft !== baseline;

  useEffect(() => {
    if (!dirty) {
      setBaseline(incoming);
      setDraft(incoming);
    }
  }, [dirty, incoming]);

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      setBaseline(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <textarea
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange?.(next);
        }}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: '420px',
          resize: 'vertical',
          background: '#020617',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '10px',
          fontFamily: 'ui-monospace, Menlo, monospace'
        }}
      />
      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => {
            save().catch(() => undefined);
          }}
          disabled={!dirty || isSaving}
          style={{
            background: dirty && !isSaving ? '#15803d' : '#475569',
            border: 'none',
            color: '#dcfce7',
            borderRadius: '6px',
            padding: '6px 10px'
          }}
        >
          {isSaving ? 'Saving...' : 'Save Markdown'}
        </button>
        <span style={{ color: '#94a3b8' }}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
      </div>
    </div>
  );
};
