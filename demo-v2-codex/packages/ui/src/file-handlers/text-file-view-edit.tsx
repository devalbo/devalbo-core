import React, { useEffect, useMemo, useState } from 'react';
import type { FileEditProps } from './types';

const coerceText = (content: string | Uint8Array): string =>
  typeof content === 'string' ? content : new TextDecoder().decode(content);

export const TextFileViewEdit: React.FC<FileEditProps> = ({ content, onSave }) => {
  const incoming = useMemo(() => coerceText(content), [content]);
  const [baseline, setBaseline] = useState(incoming);
  const [draft, setDraft] = useState(incoming);
  const [isSaving, setIsSaving] = useState(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const dirty = draft !== baseline;

  useEffect(() => {
    if (!dirty) {
      setBaseline(incoming);
      setDraft(incoming);
      setRemoteChanged(false);
      return;
    }
    if (incoming !== baseline) {
      setRemoteChanged(true);
    }
  }, [baseline, dirty, incoming]);

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      setBaseline(draft);
      setRemoteChanged(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
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
      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
            padding: '6px 10px',
            cursor: dirty && !isSaving ? 'pointer' : 'not-allowed'
          }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <span style={{ color: '#94a3b8' }}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        {remoteChanged && <span style={{ color: '#f59e0b' }}>Changed externally while editing</span>}
      </div>
    </div>
  );
};
