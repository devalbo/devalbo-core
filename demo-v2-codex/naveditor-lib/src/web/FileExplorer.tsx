import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { asDirectoryPath, detectPlatform, RuntimePlatform } from '@devalbo/shared';
import {
  listMimeTypeHandlers,
  resolveMimeTypeHandler,
  type FileContent
} from '@devalbo/ui';
import { getFilesystemBackendInfo, getWatcher } from '@/lib/file-operations';
import {
  buildTree,
  type FsTreeNode,
  getDefaultCwd,
  listDirectory,
  makeDirectory,
  readBytesFile,
  removePath,
  resolveFsPath,
  splitFsPath,
  writeBytesFile,
  writeTextFile
} from '@/lib/filesystem-actions';
import { inferMimeTypeFromPath, mimePrefersText } from '@/lib/mime';

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
  const [selectedMimeType, setSelectedMimeType] = useState('application/octet-stream');
  const [selectedContent, setSelectedContent] = useState<FileContent | null>(null);
  const [selectedRenderMode, setSelectedRenderMode] = useState<'preview' | 'edit' | 'viewEdit' | null>(null);
  const [lastSyncedContent, setLastSyncedContent] = useState<FileContent | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [status, setStatus] = useState<string>('');
  const [statusTone, setStatusTone] = useState<'info' | 'error'>('info');
  const [backendLabel, setBackendLabel] = useState<string>('loading...');
  const refreshRequestRef = useRef(0);

  const setActionStatus = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setStatus(message);
    setStatusTone(tone);
  }, []);

  const setPassiveStatus = useCallback((message: string) => {
    // Background updates should not immediately replace explicit action/error messages.
    if (!status) {
      setStatus(message);
      setStatusTone('info');
    }
  }, [status]);

  const toFileContent = useCallback((bytes: Uint8Array, mimeType: string): FileContent => {
    if (mimePrefersText(mimeType)) return new TextDecoder().decode(bytes);
    return bytes;
  }, []);

  const refresh = useCallback(async () => {
    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;
    const nextTree = await buildTree(getDefaultCwd(), '/');
    if (refreshRequestRef.current !== requestId) {
      console.info('[FileExplorer] Ignoring stale refresh result', { requestId });
      return;
    }
    setTree(nextTree);
    console.info('[FileExplorer] Applied refresh result', { requestId });
  }, []);

  const isSameContent = useCallback((left: FileContent | null, right: FileContent | null): boolean => {
    if (left == null || right == null) return left === right;
    if (typeof left === 'string' || typeof right === 'string') {
      return typeof left === 'string' && typeof right === 'string' && left === right;
    }
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }, []);

  const syncSelectedFileFromDisk = useCallback(async () => {
    if (!selectedPath || selectedIsDir) return;
    const latestBytes = await readBytesFile(getDefaultCwd(), selectedPath);
    const latest = toFileContent(latestBytes, selectedMimeType);
    const hasUnsavedLocalChanges = !isSameContent(selectedContent, lastSyncedContent);

    if (hasUnsavedLocalChanges) {
      if (!isSameContent(latest, lastSyncedContent)) {
        setPassiveStatus(`Detected external changes for ${selectedPath}. Save to keep local edits.`);
      }
      return;
    }

    if (!isSameContent(latest, selectedContent)) {
      setSelectedContent(latest);
      setLastSyncedContent(latest);
      setPassiveStatus(`Updated ${selectedPath} from another tab`);
    }
  }, [isSameContent, lastSyncedContent, selectedContent, selectedIsDir, selectedMimeType, selectedPath, setPassiveStatus, toFileContent]);

  useEffect(() => {
    refresh().catch((err: unknown) => setActionStatus(`Refresh failed: ${String(err)}`, 'error'));
  }, [refresh, setActionStatus]);

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
    let unwatch: (() => void) | undefined;
    void (async () => {
      const watcher = await getWatcher();
      unwatch = watcher.watch(asDirectoryPath('/'), (event) => {
        console.info('[FileExplorer] Watch event', event);
        void (async () => {
          await refresh();
          await syncSelectedFileFromDisk();
        })().catch((err: unknown) => setActionStatus(`Refresh failed: ${String(err)}`, 'error'));
      });
    })();

    return () => {
      unwatch?.();
    };
  }, [refresh, setActionStatus, syncSelectedFileFromDisk]);

  const breadcrumbs = useMemo(() => splitFsPath(currentDir), [currentDir]);

  const selectNode = useCallback(async (node: FsTreeNode) => {
    setSelectedPath(node.path);
    setSelectedIsDir(node.isDirectory);
    if (node.isDirectory) {
      setCurrentDir(node.path);
      setSelectedMimeType('application/octet-stream');
      setSelectedContent(null);
      setSelectedRenderMode(null);
      setLastSyncedContent(null);
      return;
    }

    const mimeType = inferMimeTypeFromPath(node.path);
    const bytes = await readBytesFile(getDefaultCwd(), node.path);
    const content = toFileContent(bytes, mimeType);
    setSelectedMimeType(mimeType);
    setSelectedContent(content);
    setSelectedRenderMode(null);
    setLastSyncedContent(content);
  }, [toFileContent]);

  const saveFile = useCallback(async (nextContent: FileContent) => {
    if (!selectedPath || selectedIsDir) return;
    if (typeof nextContent === 'string') {
      await writeTextFile(getDefaultCwd(), selectedPath, nextContent);
    } else {
      await writeBytesFile(getDefaultCwd(), selectedPath, nextContent);
    }
    setSelectedContent(nextContent);
    setLastSyncedContent(nextContent);
    setActionStatus(`Saved ${selectedPath}`);
    await refresh();
  }, [refresh, selectedIsDir, selectedPath, setActionStatus]);

  const createFile = useCallback(async () => {
    const trimmed = newFileName.trim();
    if (!trimmed) return;
    const targetPath = await writeTextFile(currentDir, trimmed, '');
    setNewFileName('');
    setActionStatus(`Created ${targetPath}`);
    await refresh();
  }, [currentDir, newFileName, refresh, setActionStatus]);

  const createFolder = useCallback(async () => {
    const folderName = window.prompt('Folder name');
    const trimmed = folderName?.trim();
    if (!trimmed) return;
    const targetPath = await makeDirectory(currentDir, trimmed);
    setActionStatus(`Created ${targetPath}/`);
    await refresh();
  }, [currentDir, refresh, setActionStatus]);

  const deleteSelected = useCallback(async () => {
    if (!selectedPath) return;
    const isTauri = detectPlatform().platform === RuntimePlatform.Tauri;
    const ok = isTauri ? true : window.confirm(`Delete ${selectedPath}?`);
    if (!ok) return;
    await removePath(getDefaultCwd(), selectedPath);
    setActionStatus(`Deleted ${selectedPath}`);
    setSelectedPath(null);
    setSelectedIsDir(false);
    setSelectedMimeType('application/octet-stream');
    setSelectedContent(null);
    setSelectedRenderMode(null);
    setLastSyncedContent(null);
    await refresh();
  }, [refresh, selectedPath, setActionStatus]);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const fileSummary = fileList.map((file) => `${file.name} (${file.size} bytes)`);
    console.info('[FileExplorer] Upload start', {
      currentDir,
      backend: backendLabel,
      files: fileSummary
    });

    try {
      for (const file of fileList) {
        console.info('[FileExplorer] Upload file write begin', {
          name: file.name,
          size: file.size,
          targetDir: currentDir
        });
        const bytes = new Uint8Array(await file.arrayBuffer());
        await writeBytesFile(currentDir, file.name, bytes);
        console.info('[FileExplorer] Upload file write success', {
          name: file.name,
          size: bytes.byteLength
        });
      }
    } catch (err) {
      const message = String(err);
      console.error('[FileExplorer] Upload failed', {
        currentDir,
        backend: backendLabel,
        error: message
      });
      if (message.toLowerCase().includes('quota')) {
        throw new Error(`Upload failed: browser storage quota exceeded while writing into ${currentDir}`);
      }
      throw err;
    }

    setActionStatus(`Uploaded ${files.length} file(s) to ${currentDir}`);
    console.info('[FileExplorer] Upload completed', {
      currentDir,
      count: fileList.length
    });
    await refresh();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add('/');
      next.add(currentDir);
      return next;
    });

    const entries = await listDirectory(getDefaultCwd(), currentDir);
    console.info('[FileExplorer] Post-upload directory listing', {
      currentDir,
      entries: entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory, size: entry.size }))
    });

    const first = fileList[0];
    if (first) {
      const uploadedPath = resolveFsPath(currentDir, first.name);
      const uploadedMimeType = inferMimeTypeFromPath(uploadedPath);
      const uploadedBytes = await readBytesFile(getDefaultCwd(), uploadedPath);
      const uploadedContent = toFileContent(uploadedBytes, uploadedMimeType);
      setSelectedPath(uploadedPath);
      setSelectedIsDir(false);
      setSelectedMimeType(uploadedMimeType);
      setSelectedContent(uploadedContent);
      setSelectedRenderMode(null);
      setLastSyncedContent(uploadedContent);
      setCurrentDir(currentDir);
      console.info('[FileExplorer] Auto-selected uploaded file', {
        path: uploadedPath,
        mimeType: uploadedMimeType,
        size: uploadedBytes.byteLength
      });
    }
  }, [backendLabel, currentDir, refresh, setActionStatus, toFileContent]);

  const selectedHandler = useMemo(() => {
    if (!selectedPath || selectedIsDir) return null;
    return resolveMimeTypeHandler(selectedMimeType);
  }, [selectedIsDir, selectedMimeType, selectedPath]);

  const availableRenderModes = useMemo(() => {
    if (!selectedHandler) return [] as Array<'preview' | 'edit' | 'viewEdit'>;
    const modes: Array<'preview' | 'edit' | 'viewEdit'> = [];
    if (selectedHandler.preview) modes.push('preview');
    if (selectedHandler.edit) modes.push('edit');
    if (selectedHandler.viewEdit) modes.push('viewEdit');
    return modes;
  }, [selectedHandler]);

  useEffect(() => {
    if (availableRenderModes.length === 0) {
      setSelectedRenderMode(null);
      return;
    }
    if (selectedRenderMode && availableRenderModes.includes(selectedRenderMode)) {
      return;
    }
    if (availableRenderModes.includes('viewEdit')) {
      setSelectedRenderMode('viewEdit');
      return;
    }
    if (availableRenderModes.includes('edit')) {
      setSelectedRenderMode('edit');
      return;
    }
    setSelectedRenderMode('preview');
  }, [availableRenderModes, selectedRenderMode]);

  const registeredHandlers = useMemo(() => listMimeTypeHandlers(), []);

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
          <button onClick={() => createFile().catch((err: unknown) => setActionStatus(`Create failed: ${String(err)}`, 'error'))} style={{ background: '#0f766e', border: 'none', color: '#ecfeff', borderRadius: '6px', padding: '6px 10px' }}>
            Create Text File
          </button>
          <button onClick={() => createFolder().catch((err: unknown) => setActionStatus(`Mkdir failed: ${String(err)}`, 'error'))} style={{ background: '#1d4ed8', border: 'none', color: '#eff6ff', borderRadius: '6px', padding: '6px 10px' }}>
            New Folder
          </button>
          <label style={{ background: '#334155', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
            Upload Files
            <input
              type="file"
              multiple
              onChange={(e) => {
                uploadFiles(e.currentTarget.files).catch((err: unknown) => setActionStatus(`Upload failed: ${String(err)}`, 'error'));
                e.currentTarget.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
          <button
            disabled={!selectedPath}
            onClick={() => deleteSelected().catch((err: unknown) => setActionStatus(`Delete failed: ${String(err)}`, 'error'))}
            style={{ background: selectedPath ? '#991b1b' : '#475569', border: 'none', color: '#fee2e2', borderRadius: '6px', padding: '6px 10px' }}
          >
            Delete Selected
          </button>
        </div>

        {status && (
          <div
            style={{
              marginBottom: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              background: statusTone === 'error' ? '#3f1111' : '#06293a',
              color: statusTone === 'error' ? '#fecaca' : '#67e8f9',
              border: statusTone === 'error' ? '1px solid #7f1d1d' : '1px solid #0e7490'
            }}
          >
            {status}
          </div>
        )}

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
            <div style={{ marginBottom: '8px', color: '#67e8f9' }}>MIME: {selectedMimeType}</div>
            {availableRenderModes.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {availableRenderModes.map((mode) => {
                  const isActive = selectedRenderMode === mode;
                  const label = mode === 'preview' ? 'View' : mode === 'edit' ? 'Edit' : 'View/Edit';
                  return (
                    <button
                      key={mode}
                      onClick={() => setSelectedRenderMode(mode)}
                      style={{
                        border: '1px solid #475569',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        background: isActive ? '#0f172a' : '#334155',
                        color: '#e2e8f0'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {!selectedHandler && (
              <div style={{ color: '#94a3b8' }}>
                No MIME handler registered for {selectedMimeType}
              </div>
            )}
            {selectedHandler && selectedContent != null && selectedRenderMode === 'viewEdit' && selectedHandler.viewEdit && (
              <selectedHandler.viewEdit
                path={selectedPath}
                mimeType={selectedMimeType}
                content={selectedContent}
                onChange={(nextContent) => setSelectedContent(nextContent)}
                onSave={(nextContent) => saveFile(nextContent)}
              />
            )}
            {selectedHandler && selectedContent != null && selectedRenderMode === 'edit' && selectedHandler.edit && (
              <selectedHandler.edit
                path={selectedPath}
                mimeType={selectedMimeType}
                content={selectedContent}
                onChange={(nextContent) => setSelectedContent(nextContent)}
                onSave={(nextContent) => saveFile(nextContent)}
              />
            )}
            {selectedHandler && selectedContent != null && selectedRenderMode === 'preview' && selectedHandler.preview && (
              <selectedHandler.preview
                path={selectedPath}
                mimeType={selectedMimeType}
                content={selectedContent}
              />
            )}
            {selectedContent != null && (!selectedHandler || (!selectedHandler.preview && !selectedHandler.edit && !selectedHandler.viewEdit)) && (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#94a3b8' }}>
                {typeof selectedContent === 'string'
                  ? selectedContent
                  : `[binary file] ${selectedContent.byteLength} bytes`}
              </pre>
            )}
          </div>
        )}

        <details style={{ marginTop: '14px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
          <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>MIME Handler Debug</summary>
          <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
            Selected MIME: {selectedMimeType}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>
            Matched pattern: {selectedHandler?.pattern ?? '(none)'}
          </div>
          <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
            {registeredHandlers.map((handler) => (
              <div
                key={handler.pattern}
                style={{
                  fontSize: '12px',
                  color: selectedHandler?.pattern === handler.pattern ? '#67e8f9' : '#cbd5e1'
                }}
              >
                {handler.pattern}
                {' | '}
                {handler.preview ? 'preview ' : ''}
                {handler.edit ? 'edit ' : ''}
                {handler.viewEdit ? 'viewEdit' : ''}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};
