import {
  unsafeAsDirectoryPath,
  unsafeAsFilePath,
  WatchEventType,
  type DirectoryPath,
  type FileEntry,
  type FilePath,
  type WatchEvent
} from '@devalbo/shared';
import { createStore, type Store } from 'tinybase';
import type { IFilesystemDriver } from '../interfaces';

const FS_TABLE = 'fs';
export const FS_STORAGE_KEY = 'naveditor.fs.v1';

type FsRow = {
  name?: string;
  isDirectory?: number;
  size?: number;
  mtime?: string;
  data?: string;
};

export interface BrowserBackendInfo {
  adapter: 'browser-store';
  persistence: 'opfs' | 'indexeddb' | 'localStorage';
}

type BrowserFsListener = (event: WatchEvent) => void;
const browserFsListeners = new Set<BrowserFsListener>();

export const subscribeBrowserFsEvents = (listener: BrowserFsListener): (() => void) => {
  browserFsListeners.add(listener);
  return () => {
    browserFsListeners.delete(listener);
  };
};

const emitBrowserFsEvent = (event: WatchEvent): void => {
  for (const listener of browserFsListeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener failures to avoid breaking filesystem operations.
    }
  }
};

const normalizeBrowserPath = (input: string): string => {
  if (input === '' || input === '.') return '/';
  if (input.startsWith('/')) return input;
  return `/${input}`;
};

const baseName = (targetPath: string): string => {
  if (targetPath === '/') return '/';
  const parts = targetPath.split('/').filter(Boolean);
  return parts.at(-1) ?? '/';
};

const parentPath = (targetPath: string): string => {
  if (targetPath === '/') return '/';
  const parts = targetPath.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return `/${parts.slice(0, -1).join('/')}`;
};

const encodeBytes = (bytes: Uint8Array): string => {
  if (typeof btoa !== 'function') {
    throw new Error('btoa is unavailable in this runtime');
  }
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const decodeBytes = (base64: string): Uint8Array => {
  if (typeof atob !== 'function') {
    throw new Error('atob is unavailable in this runtime');
  }
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

const seedBrowserStore = (store: Store): void => {
  const existing = store.getTable(FS_TABLE);
  if (Object.keys(existing).length > 0) return;

  const ensureDirectoryPath = (targetPath: string): void => {
    const normalized = normalizeBrowserPath(targetPath);
    if (normalized === '/') {
      const root = store.getRow(FS_TABLE, '/') as FsRow;
      if (!Object.keys(root ?? {}).length) {
        store.setRow(FS_TABLE, '/', {
          name: '/',
          isDirectory: 1,
          size: 0,
          mtime: new Date().toISOString(),
          data: ''
        });
      }
      return;
    }

    const parts = normalized.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = `${current}/${part}`;
      const row = store.getRow(FS_TABLE, current) as FsRow;
      if (!Object.keys(row ?? {}).length) {
        store.setRow(FS_TABLE, current, {
          name: baseName(current),
          isDirectory: 1,
          size: 0,
          mtime: new Date().toISOString(),
          data: ''
        });
      }
    }
  };

  ensureDirectoryPath('/');
  ensureDirectoryPath('/src');
  ensureDirectoryPath('/tests/fixtures/sample-files');

  const seedFiles: Record<string, string> = {
    '/README.md': '# naveditor\nBrowser demo filesystem',
    '/notes.txt': 'Type commands in the shell to navigate or edit files.',
    '/src/index.ts': 'export const hello = () => "world";',
    '/tests/fixtures/sample-files/hello.txt': 'Hello, World!'
  };

  const now = new Date().toISOString();
  Object.entries(seedFiles).forEach(([filePath, content]) => {
    const bytes = new TextEncoder().encode(content);
    store.setRow(FS_TABLE, filePath, {
      name: baseName(filePath),
      isDirectory: 0,
      size: bytes.length,
      mtime: now,
      data: encodeBytes(bytes)
    });
  });
};

export class BrowserStoreFSDriver implements IFilesystemDriver {
  private store: Store;

  private persister:
    | {
        load: () => Promise<unknown>;
        save: () => Promise<unknown>;
        startAutoSave: () => Promise<unknown>;
        startAutoLoad: () => Promise<unknown>;
      }
    | undefined;

  private initPromise: Promise<void> | undefined;
  private persistenceMode: BrowserBackendInfo['persistence'] = 'localStorage';
  private hasStoreListener = false;

  constructor() {
    this.store = createStore();
  }

  private rowForPath(targetPath: string): FsRow | undefined {
    const row = this.store.getRow(FS_TABLE, targetPath) as FsRow | undefined;
    if (!row) return undefined;
    return Object.keys(row).length === 0 ? undefined : row;
  }

  private setDirectoryRow(targetPath: string): void {
    this.store.setRow(FS_TABLE, targetPath, {
      name: baseName(targetPath),
      isDirectory: 1,
      size: 0,
      mtime: new Date().toISOString(),
      data: ''
    });
  }

  private ensureDirectoryPath(targetPath: string): string[] {
    const created: string[] = [];
    const normalized = normalizeBrowserPath(targetPath);
    if (normalized === '/') {
      if (!this.rowForPath('/')) {
        this.setDirectoryRow('/');
        created.push('/');
      }
      return created;
    }

    const parts = normalized.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = `${current}/${part}`;
      if (!this.rowForPath(current)) {
        this.setDirectoryRow(current);
        created.push(current);
      }
    }
    return created;
  }

  private ensureStoreListener(): void {
    if (this.hasStoreListener) return;
    this.store.addTableListener(FS_TABLE, () => {
      emitBrowserFsEvent({
        type: WatchEventType.Modified,
        path: unsafeAsFilePath('/'),
        timestamp: new Date()
      });
    });
    this.hasStoreListener = true;
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const { createOpfsPersister } = await import('tinybase/persisters/persister-browser');
        const opfsRoot = await navigator.storage.getDirectory();
        const opfsHandle = await opfsRoot.getFileHandle(`${FS_STORAGE_KEY}.json`, { create: true });
        const opfsPersister = createOpfsPersister(this.store, opfsHandle);
        this.persistenceMode = 'opfs';
        this.persister = opfsPersister;
        await opfsPersister.load();
        seedBrowserStore(this.store);
        await opfsPersister.save();
        await opfsPersister.startAutoSave();
        await opfsPersister.startAutoLoad();
      } catch (opfsError) {
        console.warn('OPFS init failed, trying IndexedDB persister:', opfsError);
        try {
          const { createIndexedDbPersister } = await import('tinybase/persisters/persister-indexed-db');
          this.persistenceMode = 'indexeddb';
          const indexedDbPersister = createIndexedDbPersister(this.store, FS_STORAGE_KEY);
          this.persister = indexedDbPersister;
          await indexedDbPersister.load();
          seedBrowserStore(this.store);
          await indexedDbPersister.save();
          await indexedDbPersister.startAutoSave();
          await indexedDbPersister.startAutoLoad();
        } catch (indexedDbError) {
          console.warn('IndexedDB init failed, falling back to localStorage persister:', indexedDbError);
          const { createLocalPersister } = await import('tinybase/persisters/persister-browser');
          this.persistenceMode = 'localStorage';
          const localPersister = createLocalPersister(this.store, FS_STORAGE_KEY);
          this.persister = localPersister;
          await localPersister.load();
          seedBrowserStore(this.store);
          await localPersister.save();
          await localPersister.startAutoSave();
          await localPersister.startAutoLoad();
        }
      }

      this.ensureStoreListener();
    })();

    await this.initPromise;
  }

  private async load(): Promise<void> {
    await this.init();
    await this.persister?.load();
  }

  private async save(): Promise<void> {
    await this.init();
    await this.persister?.save();
  }

  async readFile(path: FilePath): Promise<Uint8Array> {
    await this.load();
    const targetPath = normalizeBrowserPath(path);
    const row = this.rowForPath(targetPath);
    if (!row || row.isDirectory === 1) {
      throw new Error(`File not found: ${targetPath}`);
    }
    return decodeBytes(row.data ?? '');
  }

  async writeFile(path: FilePath, data: Uint8Array): Promise<void> {
    await this.init();
    const targetPath = normalizeBrowserPath(path);
    const existed = Boolean(this.rowForPath(targetPath));
    const createdDirectories = this.ensureDirectoryPath(parentPath(targetPath));
    this.store.setRow(FS_TABLE, targetPath, {
      name: baseName(targetPath),
      isDirectory: 0,
      size: data.length,
      mtime: new Date().toISOString(),
      data: encodeBytes(data)
    });
    await this.save();
    for (const createdPath of createdDirectories) {
      emitBrowserFsEvent({
        type: WatchEventType.Created,
        path: unsafeAsFilePath(createdPath),
        timestamp: new Date()
      });
    }
    emitBrowserFsEvent({
      type: existed ? WatchEventType.Modified : WatchEventType.Created,
      path: unsafeAsFilePath(targetPath),
      timestamp: new Date()
    });
  }

  async readdir(path: DirectoryPath): Promise<FileEntry[]> {
    await this.load();
    const dirPath = normalizeBrowserPath(path);
    const dirRow = this.rowForPath(dirPath);
    if (!dirRow || dirRow.isDirectory !== 1) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const prefix = dirPath === '/' ? '/' : `${dirPath}/`;
    return Object.entries(this.store.getTable(FS_TABLE) ?? {})
      .filter(([entryPath]) => entryPath !== dirPath && entryPath.startsWith(prefix))
      .filter(([entryPath]) => {
        const rel = entryPath.slice(prefix.length);
        return rel.length > 0 && !rel.includes('/');
      })
      .map(([entryPath, row]) => {
        const fsRow = row as FsRow;
        return {
          name: fsRow.name ?? baseName(entryPath),
          path: unsafeAsFilePath(entryPath),
          isDirectory: fsRow.isDirectory === 1,
          size: fsRow.size ?? 0,
          mtime: fsRow.mtime ? new Date(fsRow.mtime) : new Date()
        };
      });
  }

  async stat(path: FilePath): Promise<FileEntry> {
    await this.load();
    const targetPath = normalizeBrowserPath(path);
    const row = this.rowForPath(targetPath);
    if (!row) throw new Error(`Path not found: ${targetPath}`);

    return {
      name: row.name ?? baseName(targetPath),
      path: unsafeAsFilePath(targetPath),
      isDirectory: row.isDirectory === 1,
      size: row.size ?? 0,
      mtime: row.mtime ? new Date(row.mtime) : new Date()
    };
  }

  async mkdir(path: DirectoryPath): Promise<void> {
    await this.init();
    const dirPath = normalizeBrowserPath(path);
    const createdPaths = this.ensureDirectoryPath(dirPath);
    await this.save();
    for (const createdPath of createdPaths) {
      emitBrowserFsEvent({
        type: WatchEventType.Created,
        path: unsafeAsFilePath(createdPath),
        timestamp: new Date()
      });
    }
  }

  async rm(path: FilePath): Promise<void> {
    await this.init();
    const targetPath = normalizeBrowserPath(path);
    const existed = Boolean(this.rowForPath(targetPath));
    this.store.delRow(FS_TABLE, targetPath);
    await this.save();
    if (existed) {
      emitBrowserFsEvent({
        type: WatchEventType.Deleted,
        path: unsafeAsFilePath(targetPath),
        timestamp: new Date()
      });
    }
  }

  async exists(path: FilePath): Promise<boolean> {
    await this.load();
    const targetPath = normalizeBrowserPath(path);
    return Boolean(this.rowForPath(targetPath));
  }

  async getBackendInfo(): Promise<BrowserBackendInfo> {
    await this.init();
    return {
      adapter: 'browser-store',
      persistence: this.persistenceMode
    };
  }
}

export const toFilePath = (path: string): FilePath => unsafeAsFilePath(normalizeBrowserPath(path));
export const toDirectoryPath = (path: string): DirectoryPath => unsafeAsDirectoryPath(normalizeBrowserPath(path));
