import React from 'react';
import { InkTerminalBox } from 'ink-web';
import { InteractiveShell } from '@/components/InteractiveShell';

export const App: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '24px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: '18px' }}>naveditor</h1>
      <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', background: '#020617' }}>
        <InkTerminalBox rows={28} focus>
          <InteractiveShell />
        </InkTerminalBox>
      </div>
    </div>
  );
};
