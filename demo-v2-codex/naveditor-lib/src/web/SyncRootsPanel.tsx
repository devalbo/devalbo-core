import { useEffect, useMemo, useState } from 'react';
import { useSolidSession } from '@devalbo/solid-client';
import {
  deleteFileSyncState,
  deleteSyncRoot,
  FILE_SYNC_STATE_TABLE,
  listFileSyncStatesForRoot,
  listSyncRoots,
  setSyncRoot,
  SYNC_ROOTS_TABLE,
  useAppConfig,
  useStore
} from '@devalbo/state';
import {
  assertAbsolutePath,
  assertPodUrl,
  assertSyncRootId,
  assertWebId,
  BrowserConnectivityService
} from '@devalbo/shared';
import { findRootConflicts } from '@devalbo/solid-client';
import { useFileSyncMap } from '@/components/social/FileSyncContext';

type Resolution = 'keep-local' | 'keep-pod' | 'keep-both';

export const SyncRootsPanel: React.FC = () => {
  const store = useStore();
  const config = useAppConfig();
  const session = useSolidSession();
  const fileSyncMap = useFileSyncMap();
  const [version, setVersion] = useState(0);
  const [isOnline, setIsOnline] = useState(() => new BrowserConnectivityService().isOnline());
  const [localPath, setLocalPath] = useState('/home/');
  const [podUrl, setPodUrl] = useState('');
  const [label, setLabel] = useState('');
  const [readonly, setReadonly] = useState(false);
  const [webId, setWebId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [pullingRootId, setPullingRootId] = useState<string | null>(null);

  useEffect(() => {
    setWebId(session?.webId ?? '');
  }, [session?.webId]);

  useEffect(() => {
    const syncRootsListener = store.addTableListener(SYNC_ROOTS_TABLE, () => setVersion((v) => v + 1));
    const fileStateListener = store.addTableListener(FILE_SYNC_STATE_TABLE, () => setVersion((v) => v + 1));
    return () => {
      store.delListener(syncRootsListener);
      store.delListener(fileStateListener);
    };
  }, [store]);

  useEffect(() => {
    const connectivity = new BrowserConnectivityService();
    setIsOnline(connectivity.isOnline());
    const off = () => setIsOnline(false);
    window.addEventListener('offline', off);
    const unsubscribeOnline = connectivity.onOnline(() => setIsOnline(true));
    return () => {
      window.removeEventListener('offline', off);
      unsubscribeOnline();
    };
  }, []);

  const roots = useMemo(() => listSyncRoots(store), [store, version]);

  const pendingOfflineCount = useMemo(() => {
    return roots.reduce((count, root) => {
      const rows = listFileSyncStatesForRoot(store, root.id);
      return count + rows.filter((row) => row.status === 'pending_upload').length;
    }, 0);
  }, [roots, store, version]);

  const addRoot = (): void => {
    try {
      if (!localPath.endsWith('/')) {
        setStatus(`Error: localPath "${localPath}" must end with "/".`);
        return;
      }
      if (!podUrl.endsWith('/')) {
        setStatus(`Error: podUrl "${podUrl}" must end with "/".`);
        return;
      }
      if (localPath.startsWith(config.socialLocalPath) || config.socialLocalPath.startsWith(localPath)) {
        setStatus(`Error: localPath "${localPath}" overlaps reserved path (${config.socialLocalPath}).`);
        return;
      }
      const parsedPodUrl = assertPodUrl(podUrl);
      const socialPodBase = `${new URL(parsedPodUrl).origin}/${config.podNamespace}/`;
      const fileSyncBase = `${new URL(parsedPodUrl).origin}/${config.podNamespace}/files/`;
      if (parsedPodUrl.startsWith(socialPodBase) && !parsedPodUrl.startsWith(fileSyncBase)) {
        setStatus(`Error: podUrl overlaps social namespace. Use ${fileSyncBase} or outside ${socialPodBase}.`);
        return;
      }

      const root = {
        id: assertSyncRootId(crypto.randomUUID()),
        label,
        localPath: localPath as (typeof roots)[number]['localPath'],
        podUrl: parsedPodUrl,
        webId: assertWebId((webId || session?.webId || '').trim()),
        readonly,
        enabled: true
      };
      const conflicts = findRootConflicts([...roots, root]);
      if (conflicts.length > 0) {
        const pair = conflicts[0];
        if (pair) setStatus(`Error: root overlaps with ${pair[0].localPath} or ${pair[1].localPath}.`);
        return;
      }
      setSyncRoot(store, root);
      setStatus(`Added sync root ${root.id.slice(0, 8)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const removeRoot = (rootId: string): void => {
    try {
      const brandedId = assertSyncRootId(rootId);
      const rows = listFileSyncStatesForRoot(store, brandedId);
      for (const row of rows) deleteFileSyncState(store, row.path);
      deleteSyncRoot(store, brandedId);
      setPendingDeleteId(null);
      setStatus(`Removed sync root ${rootId.slice(0, 8)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleRoot = (rootId: string, enabled: boolean): void => {
    const root = roots.find((r) => r.id === rootId);
    if (!root) return;
    setSyncRoot(store, { ...root, enabled });
  };

  const pullRoot = async (rootId: string): Promise<void> => {
    setPullingRootId(rootId);
    try {
      const sync = fileSyncMap.get(assertSyncRootId(rootId));
      if (!sync) {
        setStatus(`Sync root ${rootId.slice(0, 8)} is inactive.`);
        return;
      }
      const summary = await sync.pullAll();
      setStatus(`Pulled ${summary.downloaded} files for ${rootId.slice(0, 8)} (${summary.conflicts} conflicts)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setPullingRootId(null);
    }
  };

  const resolveConflict = async (path: string, resolution: Resolution): Promise<void> => {
    const root = roots.find((r) => path.startsWith(r.localPath));
    if (!root) return;
    const sync = fileSyncMap.get(root.id);
    if (!sync) return;
    await sync.resolveConflict(assertAbsolutePath(path), resolution);
    setStatus(`Resolved conflict: ${path} (${resolution})`);
  };

  return (
    <div style={{ borderTop: '1px solid #334155', padding: '10px' }}>
      <div style={{ color: '#cbd5e1', fontWeight: 600, marginBottom: '8px' }}>Sync Roots</div>
      {!isOnline && pendingOfflineCount > 0 && (
        <div style={{ marginBottom: '8px', padding: '6px 8px', borderRadius: '6px', background: '#3f1111', color: '#fecaca' }}>
          Offline - {pendingOfflineCount} changes pending
        </div>
      )}

      <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
        {roots.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px' }}>No sync roots configured.</div>}
        {roots.map((root) => {
          const rows = listFileSyncStatesForRoot(store, root.id);
          const pending = rows.filter((r) => r.status === 'pending_upload' || r.status === 'pending_delete').length;
          const conflicts = rows.filter((r) => r.status === 'conflict');
          return (
            <div key={root.id} style={{ border: '1px solid #334155', borderRadius: '6px', padding: '6px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ color: '#e2e8f0', fontSize: '12px' }}>
                  <strong>{root.label || root.id.slice(0, 8)}</strong> {root.localPath} -&gt; {root.podUrl}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => void pullRoot(root.id)}
                    style={{ background: '#1d4ed8', border: 'none', color: '#eff6ff', borderRadius: '4px', padding: '3px 6px' }}
                  >
                    {pullingRootId === root.id ? 'Pulling...' : '↓ Pull'}
                  </button>
                  <label style={{ color: '#94a3b8', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={root.enabled}
                      onChange={(e) => toggleRoot(root.id, e.target.checked)}
                      style={{ marginRight: '4px' }}
                    />
                    enabled
                  </label>
                  {pendingDeleteId === root.id ? (
                    <>
                      <button
                        onClick={() => removeRoot(root.id)}
                        style={{ background: '#991b1b', border: 'none', color: '#fee2e2', borderRadius: '4px', padding: '3px 6px' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        style={{ background: '#334155', border: 'none', color: '#cbd5e1', borderRadius: '4px', padding: '3px 6px' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setPendingDeleteId(root.id)}
                      style={{ background: '#7f1d1d', border: 'none', color: '#fee2e2', borderRadius: '4px', padding: '3px 6px' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                pending: {pending} conflicts: {conflicts.length}
              </div>
              {conflicts.map((row) => (
                <div key={row.path} style={{ marginTop: '5px', padding: '5px', borderRadius: '4px', background: '#3f2a0b' }}>
                  <div style={{ color: '#fde68a', fontSize: '11px' }}>⚠ {row.path}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button onClick={() => void resolveConflict(row.path, 'keep-local')} style={{ fontSize: '11px' }}>keep-local</button>
                    <button onClick={() => void resolveConflict(row.path, 'keep-pod')} style={{ fontSize: '11px' }}>keep-pod</button>
                    <button onClick={() => void resolveConflict(row.path, 'keep-both')} style={{ fontSize: '11px' }}>keep-both</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px dashed #334155', paddingTop: '8px' }}>
        <div style={{ color: '#cbd5e1', fontSize: '12px', marginBottom: '6px' }}>Add Sync Root</div>
        <input
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          placeholder="/home/work/"
          style={{ width: '100%', marginBottom: '6px', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '4px', padding: '5px' }}
        />
        <input
          value={podUrl}
          onChange={(e) => setPodUrl(e.target.value)}
          placeholder="https://alice.example/devalbo/files/work/"
          style={{ width: '100%', marginBottom: '6px', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '4px', padding: '5px' }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          style={{ width: '100%', marginBottom: '6px', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '4px', padding: '5px' }}
        />
        <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
          <input type="checkbox" checked={readonly} onChange={(e) => setReadonly(e.target.checked)} style={{ marginRight: '4px' }} />
          readonly
        </label>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', padding: 0, marginBottom: '6px', cursor: 'pointer' }}
        >
          {showAdvanced ? 'Hide Advanced' : 'Advanced'}
        </button>
        {showAdvanced && (
          <input
            value={webId}
            onChange={(e) => setWebId(e.target.value)}
            placeholder="https://alice.example/profile#me"
            style={{ width: '100%', marginBottom: '6px', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '4px', padding: '5px' }}
          />
        )}
        <button onClick={addRoot} style={{ background: '#0f766e', border: 'none', color: '#ecfeff', borderRadius: '4px', padding: '5px 8px' }}>
          + Add sync root
        </button>
      </div>

      {status && <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '8px' }}>{status}</div>}
    </div>
  );
};
