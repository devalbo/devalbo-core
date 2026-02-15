import React, { useEffect, useState } from 'react';
import { InkTerminalBox } from 'ink-web';
import { registerDefaultMimeTypeHandlers } from '@devalbo/ui';
import { InteractiveShell } from '@/components/InteractiveShell';
import { FileExplorer } from './FileExplorer';

export const App: React.FC = () => {
  const [tab, setTab] = useState<'terminal' | 'explorer'>('terminal');

  useEffect(() => {
    registerDefaultMimeTypeHandlers();
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '24px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: '18px' }}>naveditor</h1>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <button
          onClick={() => setTab('terminal')}
          style={{
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            background: tab === 'terminal' ? '#0f172a' : '#1e293b',
            color: '#e2e8f0'
          }}
        >
          Terminal
        </button>
        <button
          onClick={() => setTab('explorer')}
          style={{
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            background: tab === 'explorer' ? '#0f172a' : '#1e293b',
            color: '#e2e8f0'
          }}
        >
          File Explorer
        </button>
      </div>

      {tab === 'terminal' && (
        <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', background: '#020617' }}>
          <InkTerminalBox rows={28} focus>
            <InteractiveShell />
          </InkTerminalBox>
        </div>
      )}

      {tab === 'explorer' && <FileExplorer />}
    </div>
  );
};
