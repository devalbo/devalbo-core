import React, { useEffect, useMemo, useState } from 'react';
import { InkTerminalBox } from 'ink-web';
import { registerDefaultMimeTypeHandlers } from '@devalbo/ui';
import { createDevalboStore, StoreContext } from '@devalbo/state';
import { InteractiveShell } from '@/components/InteractiveShell';
import { ActivePersonaProvider } from '@/components/social/ActivePersonaContext';
import { CardExchangeTab } from '@/components/social/d1/CardExchangeTab';
import { ActivityConsoleTab } from '@/components/social/d2/ActivityConsoleTab';
import { RelationshipDashboardTab } from '@/components/social/d3/RelationshipDashboardTab';
import { FileExplorer } from '@/web/FileExplorer';

export const App: React.FC = () => {
  const [tab, setTab] = useState<'terminal' | 'explorer' | 'people'>('terminal');
  const [peopleMode, setPeopleMode] = useState<'d1' | 'd2' | 'd3'>('d3');
  const store = useMemo(() => createDevalboStore(), []);

  useEffect(() => {
    registerDefaultMimeTypeHandlers();
  }, []);

  return (
    <StoreContext.Provider value={store}>
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
          <button
            onClick={() => setTab('people')}
            style={{
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              background: tab === 'people' ? '#0f172a' : '#1e293b',
              color: '#e2e8f0'
            }}
          >
            People
          </button>
        </div>

        {tab === 'terminal' && (
          <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', background: '#020617' }}>
            <InkTerminalBox rows={28} focus>
              <InteractiveShell store={store} />
            </InkTerminalBox>
          </div>
        )}

        {tab === 'explorer' && <FileExplorer />}
        {tab === 'people' && (
          <ActivePersonaProvider>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button onClick={() => setPeopleMode('d1')} style={{ border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', background: peopleMode === 'd1' ? '#0f172a' : '#1e293b', color: '#e2e8f0' }}>D1 Card Exchange</button>
              <button onClick={() => setPeopleMode('d2')} style={{ border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', background: peopleMode === 'd2' ? '#0f172a' : '#1e293b', color: '#e2e8f0' }}>D2 Activity Console</button>
              <button onClick={() => setPeopleMode('d3')} style={{ border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', background: peopleMode === 'd3' ? '#0f172a' : '#1e293b', color: '#e2e8f0' }}>D3 Relationship Dashboard</button>
            </div>
            {peopleMode === 'd1' && <CardExchangeTab />}
            {peopleMode === 'd2' && <ActivityConsoleTab />}
            {peopleMode === 'd3' && <RelationshipDashboardTab />}
          </ActivePersonaProvider>
        )}
      </div>
    </StoreContext.Provider>
  );
};
