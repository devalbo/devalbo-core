import React, { useEffect, useRef, useState } from 'react';
import { InkTerminalBox } from 'ink-web';
import {
  AppConfigProvider,
  createDevalboStore,
  listSyncRoots,
  SYNC_ROOTS_TABLE,
  StoreContext,
  useAppConfig,
  type DevalboStore
} from '@devalbo/state';
import { createFilesystemDriver, createWatcherService, type IFilesystemDriver, type IWatcherService } from '@devalbo/filesystem';
import {
  BrowserConnectivityService,
  detectPlatform,
  RuntimePlatform,
  type SyncRoot
} from '@devalbo/shared';
import {
  SolidLdpFileSynchronizer,
  SolidLdpSynchronizer,
  SolidSessionProvider,
  useSolidSession
} from '@devalbo/solid-client';
import { createLocalPersister } from 'tinybase/persisters/persister-browser';
import { InteractiveShell, bindCliRuntimeSource, unbindCliRuntimeSource } from '@devalbo/cli-shell';
import { commands } from '@/commands';
import { ActivePersonaProvider } from '@/components/social/ActivePersonaContext';
import { FileSyncContext, type FileSyncMap } from '@/components/social/FileSyncContext';
import { CardExchangeTab } from '@/components/social/d1/CardExchangeTab';
import { ActivityConsoleTab } from '@/components/social/d2/ActivityConsoleTab';
import { RelationshipDashboardTab } from '@/components/social/d3/RelationshipDashboardTab';
import { SolidSyncBar } from '@/components/social/SolidSyncBar';
import { useSolidProfileSync } from '@/hooks/useSolidProfileSync';
import { createProgram } from '@/program';
import { FileExplorer } from '@/web/FileExplorer';
import { registerDesktopMimeTypeHandlers } from './handlers/register-desktop-handlers';
import { defaultAppConfig } from './config';

const getDefaultCwd = (): string => {
  if (detectPlatform().platform !== RuntimePlatform.NodeJS) return '/';
  const nodeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
  return nodeProcess?.cwd?.() ?? '/';
};

const WELCOME_MESSAGE = 'Try: pwd, ls, export ., import snapshot.bft restore, backend';

const AppContent: React.FC<{ store: DevalboStore }> = ({ store }) => {
  const [tab, setTab] = useState<'terminal' | 'explorer' | 'people'>('terminal');
  const [peopleMode, setPeopleMode] = useState<'d1' | 'd2' | 'd3'>('d3');
  const [fileSyncMap, setFileSyncMap] = useState<FileSyncMap>(() => new Map());
  const [syncRoots, setSyncRoots] = useState<SyncRoot[]>(() => listSyncRoots(store));
  const [driver, setDriver] = useState<IFilesystemDriver | null>(null);
  const [watcher, setWatcher] = useState<IWatcherService | null>(null);
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
    registerDesktopMimeTypeHandlers();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([createFilesystemDriver(), createWatcherService()]).then(([nextDriver, nextWatcher]) => {
      if (cancelled) return;
      setDriver(nextDriver);
      setWatcher(nextWatcher);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const listenerId = store.addTableListener(SYNC_ROOTS_TABLE, () => {
      setSyncRoots(listSyncRoots(store));
    });
    return () => {
      store.delListener(listenerId);
    };
  }, [store]);

  useEffect(() => {
    if (!session?.isAuthenticated) return;
    if (!config.features.socialSync) return;
    let sync: SolidLdpSynchronizer;
    try {
      sync = new SolidLdpSynchronizer(store, session, config.podNamespace, config.sync.social);
      sync.start();
    } catch {
      return;
    }
    return () => sync.stop();
  }, [config, session, store]);

  useEffect(() => {
    if (!session?.isAuthenticated || !config.features.fileSync || !driver || !watcher) {
      setFileSyncMap(new Map());
      return;
    }
    const allRoots = syncRoots;
    const activeRoots = allRoots.filter((root) => root.enabled && root.webId === session.webId);
    const newMap: FileSyncMap = new Map();

    for (const root of activeRoots) {
      try {
        newMap.set(
          root.id,
          new SolidLdpFileSynchronizer(root, allRoots, session, store, driver, watcher, config.sync.files, connectivity)
        );
      } catch (error) {
        console.warn(`[FileSyncMap] Skipping root ${root.id} (${root.localPath}): constructor threw`, error);
      }
    }

    setFileSyncMap(newMap);
    for (const sync of newMap.values()) sync.start();
    return () => {
      for (const sync of newMap.values()) sync.stop();
      setFileSyncMap(new Map());
    };
  }, [config, connectivity, driver, session, store, syncRoots, watcher]);

  useEffect(() => {
    bindCliRuntimeSource({
      getContext: () => {
        if (!store || !driverRef.current) return null;
        return {
          commands,
          createProgram,
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
    <FileSyncContext.Provider value={fileSyncMap}>
      <StoreContext.Provider value={store}>
        <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '18px', margin: 0 }}>naveditor desktop</h1>
            <SolidSyncBar store={store} config={config} />
          </div>
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
                <InteractiveShell
                  commands={commands}
                  createProgram={createProgram}
                  session={session}
                  store={store}
                  config={config}
                  driver={driver}
                  cwd={cwd}
                  setCwd={setCwd}
                  welcomeMessage={WELCOME_MESSAGE}
                />
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
    </FileSyncContext.Provider>
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
