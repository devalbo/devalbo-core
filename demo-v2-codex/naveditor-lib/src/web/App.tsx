import React, { useEffect, useRef, useState } from 'react';
import { InkTerminalBox } from 'ink-web';
import { registerDefaultMimeTypeHandlers } from '@devalbo/ui';
import {
  AppConfigProvider,
  createDevalboStore,
  useAppConfig,
  StoreContext,
  type DevalboStore
} from '@devalbo/state';
import { createFilesystemDriver, type IFilesystemDriver } from '@devalbo/filesystem';
import {
  BrowserConnectivityService,
  detectPlatform,
  RuntimePlatform
} from '@devalbo/shared';
import { SolidSessionProvider, useSolidSession } from '@devalbo/solid-client';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { InteractiveShell } from '@/components/InteractiveShell';
import { useSolidProfileSync } from '@/hooks/useSolidProfileSync';
import { bindCliRuntimeSource, unbindCliRuntimeSource } from '@/web/console-helpers';
import { defaultAppConfig } from '@/web/config';
import { FileExplorer } from './FileExplorer';

const getDefaultCwd = (): string => {
  if (detectPlatform().platform !== RuntimePlatform.NodeJS) return '/';
  const nodeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
  return nodeProcess?.cwd?.() ?? '/';
};

const AppContent: React.FC<{ store: DevalboStore }> = ({ store }) => {
  const [tab, setTab] = useState<'terminal' | 'explorer'>('terminal');
  const [driver, setDriver] = useState<IFilesystemDriver | null>(null);
  const [cwd, setCwd] = useState<string>(() => getDefaultCwd());
  const [connectivity] = useState(() => new BrowserConnectivityService());
  const config = useAppConfig();
  const session = useSolidSession();

  useSolidProfileSync(store);

  const cwdRef = useRef(cwd);
  const sessionRef = useRef(session);
  const driverRef = useRef(driver);
  const configRef = useRef(config);
  cwdRef.current = cwd;
  sessionRef.current = session;
  driverRef.current = driver;
  configRef.current = config;

  useEffect(() => {
    registerDefaultMimeTypeHandlers();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void createFilesystemDriver().then((nextDriver) => {
      if (cancelled) return;
      setDriver(nextDriver);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bindCliRuntimeSource({
      getContext: () => {
        if (!store || !driverRef.current) return null;
        return {
          store,
          session: sessionRef.current,
          config: configRef.current,
          driver: driverRef.current,
          connectivity,
          cwd: cwdRef.current,
          setCwd
        };
      }
    });
    return () => unbindCliRuntimeSource();
  }, [store, connectivity, setCwd]);

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
        </div>

        {tab === 'terminal' && (
          <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', background: '#020617' }}>
            <InkTerminalBox rows={28} focus>
              <InteractiveShell store={store} config={config} driver={driver} cwd={cwd} setCwd={setCwd} />
            </InkTerminalBox>
          </div>
        )}

        {tab === 'explorer' && <FileExplorer />}
      </div>
    </StoreContext.Provider>
  );
};

export const App: React.FC = () => {
  const [store] = useState(() => createDevalboStore());

  useEffect(() => {
    const persister = createLocalPersister(store, defaultAppConfig.storageKey);
    let stopped = false;
    void persister.startAutoLoad().then(() => {
      if (stopped) return;
      return persister.startAutoSave();
    });
    return () => {
      stopped = true;
      void persister.stopAutoLoad();
      void persister.stopAutoSave();
    };
  }, [store]);

  return (
    <SolidSessionProvider>
      <AppConfigProvider config={defaultAppConfig}>
        <AppContent store={store} />
      </AppConfigProvider>
    </SolidSessionProvider>
  );
};
