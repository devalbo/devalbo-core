import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FS_STORAGE_KEY, getFilesystemBackendInfo } from '@/lib/file-operations';
import {
  buildTree,
  type FsTreeNode,
  getDefaultCwd,
  makeDirectory,
  readTextFile,
  removePath,
  resolveFsPath,
  splitFsPath,
  writeBytesFile,
  writeTextFile
} from '@/lib/filesystem-actions';

function TreeItem({
  node,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect
}: {
  node: FsTreeNode;
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (node: FsTreeNode) => void;
}) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <button
        onClick={() => {
          if (node.isDirectory) onToggle(node.path);
          onSelect(node);
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: isSelected ? '#0f172a' : 'transparent',
          color: '#e2e8f0',
          padding: '4px 8px',
          paddingLeft: `${8 + depth * 14}px`,
          cursor: 'pointer'
        }}
      >
        {node.isDirectory ? (isExpanded ? '▾ ' : '▸ ') : '  '}
        {node.name}
      </button>
      {node.isDirectory && isExpanded && node.children?.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export const FileExplorer: React.FC = () => {
  const [tree, setTree] = useState<FsTreeNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['/']));
  const [currentDir, setCurrentDir] = useState(getDefaultCwd());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [lastSyncedContent, setLastSyncedContent] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [status, setStatus] = useState<string>('');
  const [backendLabel, setBackendLabel] = useState<string>('loading...');

  const refresh = useCallback(async () => {
    const nextTree = await buildTree(getDefaultCwd(), '/');
    setTree(nextTree);
  }, []);

  const syncSelectedFileFromDisk = useCallback(async () => {
    if (!selectedPath || selectedIsDir) return;
    const latest = await readTextFile(getDefaultCwd(), selectedPath);

    if (editorDirty) {
      // Only report out-of-sync when disk changed away from the last synced baseline.
      if (latest !== lastSyncedContent) {
        setStatus(`Detected external changes for ${selectedPath}. Save or reload to apply.`);
      }
      return;
    }

    if (latest !== editorValue) {
      setEditorValue(latest);
      setLastSyncedContent(latest);
      setEditorDirty(false);
      setStatus(`Updated ${selectedPath} from another tab`);
    }
  }, [editorDirty, editorValue, lastSyncedContent, selectedIsDir, selectedPath]);

  useEffect(() => {
    refresh().catch((err: unknown) => setStatus(`Refresh failed: ${String(err)}`));
  }, [refresh]);

  useEffect(() => {
    getFilesystemBackendInfo()
      .then((info) => {
        const parts: string[] = [info.adapter];
        if (info.persistence) parts.push(info.persistence);
        if (info.baseDir) parts.push(info.baseDir);
        setBackendLabel(parts.join(' | '));
      })
      .catch((err: unknown) => setBackendLabel(`error: ${String(err)}`));
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== FS_STORAGE_KEY) return;
      (async () => {
        await refresh();
        await syncSelectedFileFromDisk();
      })().catch((err: unknown) => setStatus(`Refresh failed: ${String(err)}`));
    };

    const onFocus = () => {
      (async () => {
        await refresh();
        await syncSelectedFileFromDisk();
      })().catch((err: unknown) => setStatus(`Refresh failed: ${String(err)}`));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        (async () => {
          await refresh();
          await syncSelectedFileFromDisk();
        })().catch((err: unknown) => setStatus(`Refresh failed: ${String(err)}`));
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, syncSelectedFileFromDisk]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      (async () => {
        await refresh();
        await syncSelectedFileFromDisk();
      })().catch((err: unknown) => setStatus(`Refresh failed: ${String(err)}`));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [refresh, syncSelectedFileFromDisk]);

  const breadcrumbs = useMemo(() => splitFsPath(currentDir), [currentDir]);

  const selectNode = useCallback(async (node: FsTreeNode) => {
    setSelectedPath(node.path);
    setSelectedIsDir(node.isDirectory);
    if (node.isDirectory) {
      setCurrentDir(node.path);
      setEditorValue('');
      setLastSyncedContent('');
      setEditorDirty(false);
      return;
    }

    const content = await readTextFile(getDefaultCwd(), node.path);
    setEditorValue(content);
    setLastSyncedContent(content);
    setEditorDirty(false);
  }, []);

  const saveFile = useCallback(async () => {
    if (!selectedPath || selectedIsDir) return;
    await writeTextFile(getDefaultCwd(), selectedPath, editorValue);
    setLastSyncedContent(editorValue);
    setEditorDirty(false);
    setStatus(`Saved ${selectedPath}`);
    await refresh();
  }, [editorValue, refresh, selectedIsDir, selectedPath]);

  const createFile = useCallback(async () => {
    const trimmed = newFileName.trim();
    if (!trimmed) return;
    const targetPath = await writeTextFile(currentDir, trimmed, '');
    setNewFileName('');
    setStatus(`Created ${targetPath}`);
    await refresh();
  }, [currentDir, newFileName, refresh]);

  const createFolder = useCallback(async () => {
    const folderName = window.prompt('Folder name');
    const trimmed = folderName?.trim();
    if (!trimmed) return;
    const targetPath = await makeDirectory(currentDir, trimmed);
    setStatus(`Created ${targetPath}/`);
    await refresh();
  }, [currentDir, refresh]);

  const deleteSelected = useCallback(async () => {
    if (!selectedPath) return;
    const ok = window.confirm(`Delete ${selectedPath}?`);
    if (!ok) return;
    await removePath(getDefaultCwd(), selectedPath);
    setStatus(`Deleted ${selectedPath}`);
    setSelectedPath(null);
    setSelectedIsDir(false);
    setEditorValue('');
    setLastSyncedContent('');
    setEditorDirty(false);
    await refresh();
  }, [refresh, selectedPath]);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await writeBytesFile(currentDir, file.name, bytes);
    }

    setStatus(`Uploaded ${files.length} file(s) to ${currentDir}`);
    await refresh();
  }, [currentDir, refresh]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '12px', minHeight: '680px' }}>
      <div style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'auto', background: '#0b1220' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #334155', color: '#cbd5e1', fontWeight: 600 }}>Files</div>
        {tree ? (
          <TreeItem
            node={tree}
            depth={0}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={(path) => {
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
              });
            }}
            onSelect={(node) => {
              selectNode(node).catch((err: unknown) => setStatus(`Open failed: ${String(err)}`));
            }}
          />
        ) : (
          <div style={{ padding: '12px', color: '#94a3b8' }}>Loading...</div>
        )}
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: '8px', background: '#0b1220', color: '#e2e8f0', padding: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{ color: '#94a3b8' }}>Current dir:</span>
          <span style={{ color: '#67e8f9', fontSize: '12px' }}>Backend: {backendLabel}</span>
          <button onClick={() => setCurrentDir(getDefaultCwd())} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '6px', padding: '4px 8px' }}>
            {getDefaultCwd()}
          </button>
          {breadcrumbs.map((part, index) => {
            const partial = resolveFsPath(getDefaultCwd(), breadcrumbs.slice(0, index + 1).join('/'));
            return (
              <button
                key={partial}
                onClick={() => setCurrentDir(partial)}
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '6px', padding: '4px 8px' }}
              >
                {part}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <input
            placeholder="new-file.txt"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            style={{ background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '6px', padding: '6px 8px', minWidth: '180px' }}
          />
          <button onClick={() => createFile().catch((err: unknown) => setStatus(`Create failed: ${String(err)}`))} style={{ background: '#0f766e', border: 'none', color: '#ecfeff', borderRadius: '6px', padding: '6px 10px' }}>
            Create Text File
          </button>
          <button onClick={() => createFolder().catch((err: unknown) => setStatus(`Mkdir failed: ${String(err)}`))} style={{ background: '#1d4ed8', border: 'none', color: '#eff6ff', borderRadius: '6px', padding: '6px 10px' }}>
            New Folder
          </button>
          <label style={{ background: '#334155', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
            Upload Files
            <input
              type="file"
              multiple
              onChange={(e) => {
                uploadFiles(e.currentTarget.files).catch((err: unknown) => setStatus(`Upload failed: ${String(err)}`));
                e.currentTarget.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
          <button
            disabled={!selectedPath}
            onClick={() => deleteSelected().catch((err: unknown) => setStatus(`Delete failed: ${String(err)}`))}
            style={{ background: selectedPath ? '#991b1b' : '#475569', border: 'none', color: '#fee2e2', borderRadius: '6px', padding: '6px 10px' }}
          >
            Delete Selected
          </button>
        </div>

        <div style={{ marginBottom: '8px', color: '#94a3b8' }}>
          Selected: {selectedPath ?? '(none)'}
        </div>

        {!selectedPath && (
          <div style={{ color: '#94a3b8' }}>Select a file to view/edit it.</div>
        )}

        {selectedPath && selectedIsDir && (
          <div style={{ color: '#94a3b8' }}>Directory selected. Choose a file to edit.</div>
        )}

        {selectedPath && !selectedIsDir && (
          <div>
            <textarea
              value={editorValue}
              onChange={(e) => {
                setEditorValue(e.target.value);
                setEditorDirty(true);
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
                onClick={() => saveFile().catch((err: unknown) => setStatus(`Save failed: ${String(err)}`))}
                disabled={!editorDirty}
                style={{ background: editorDirty ? '#15803d' : '#475569', border: 'none', color: '#dcfce7', borderRadius: '6px', padding: '6px 10px' }}
              >
                Save
              </button>
              <span style={{ color: '#94a3b8' }}>{editorDirty ? 'Unsaved changes' : 'Saved'}</span>
            </div>
          </div>
        )}

        {status && (
          <div style={{ marginTop: '12px', color: '#67e8f9' }}>{status}</div>
        )}
      </div>
    </div>
  );
};
