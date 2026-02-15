import { asDirectoryPath, asFilePath, detectPlatform, RuntimePlatform } from '@devalbo/shared';
import { createWatcherService, type IFilesystemDriver, type IWatcherService } from '@devalbo/filesystem';
import { createStore, type Store } from 'tinybase';

let browserDriver: IFilesystemDriver | undefined;
let browserInitPromise: Promise<void> | undefined;
let browserStore: Store | undefined;
let browserPersister:
  | {
      load: () => Promise<unknown>;
      save: () => Promise<unknown>;
      startAutoSave: () => Promise<unknown>;
      startAutoLoad: () => Promise<unknown>;
    }
  | undefined;

const FS_TABLE = 'fs';
const FS_STORAGE_KEY = 'naveditor.fs.v1';

type FsRow = {
  name?: string;
  isDirectory?: number;
  size?: number;
  mtime?: string;
  data?: string;
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
  if (typeof btoa === 'function') {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
};

const decodeBytes = (base64: string): Uint8Array => {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
};

const rowForPath = (targetPath: string): FsRow | undefined => {
  const row = browserStore?.getRow(FS_TABLE, targetPath) as FsRow | undefined;
  if (!row) return undefined;
  return Object.keys(row).length === 0 ? undefined : row;
};

const setDirectoryRow = (targetPath: string): void => {
  browserStore?.setRow(FS_TABLE, targetPath, {
    name: baseName(targetPath),
    isDirectory: 1,
    size: 0,
    mtime: new Date().toISOString(),
    data: ''
  });
};

const ensureDirectoryPath = (targetPath: string): void => {
  const normalized = normalizeBrowserPath(targetPath);
  if (normalized === '/') {
    if (!rowForPath('/')) setDirectoryRow('/');
    return;
  }

  const parts = normalized.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current = `${current}/${part}`;
    if (!rowForPath(current)) setDirectoryRow(current);
  }
};

const seedBrowserStore = (): void => {
  if (!browserStore) return;
  const existing = browserStore.getTable(FS_TABLE);
  if (Object.keys(existing).length > 0) return;

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
    browserStore?.setRow(FS_TABLE, filePath, {
      name: baseName(filePath),
      isDirectory: 0,
      size: bytes.length,
      mtime: now,
      data: encodeBytes(bytes)
    });
  });
};

const initBrowserStore = async (): Promise<void> => {
  if (browserInitPromise) return browserInitPromise;
  browserInitPromise = (async () => {
    browserStore = createStore();
    const { createLocalPersister } = await import('tinybase/persisters/persister-browser');
    const persister = createLocalPersister(browserStore, FS_STORAGE_KEY);
    browserPersister = persister;
    await persister.load();
    seedBrowserStore();
    await persister.save();
    await persister.startAutoSave();
    await persister.startAutoLoad();
  })();
  await browserInitPromise;
};

export const getDriver = async (): Promise<IFilesystemDriver> => {
  const env = detectPlatform();
  if (env.platform === RuntimePlatform.NodeJS) {
    const { NativeFSDriver } = await import('@devalbo/filesystem/node');
    return new NativeFSDriver();
  }
  if (!browserDriver) {
    await initBrowserStore();
    browserDriver = {
      readFile: async (path) => {
        await browserPersister?.load();
        const targetPath = normalizeBrowserPath(path);
        const row = rowForPath(targetPath);
        if (!row || row.isDirectory === 1) {
          throw new Error(`File not found: ${targetPath}`);
        }
        return decodeBytes(row.data ?? '');
      },
      writeFile: async (path, data) => {
        const targetPath = normalizeBrowserPath(path);
        ensureDirectoryPath(parentPath(targetPath));
        browserStore?.setRow(FS_TABLE, targetPath, {
          name: baseName(targetPath),
          isDirectory: 0,
          size: data.length,
          mtime: new Date().toISOString(),
          data: encodeBytes(data)
        });
      },
      readdir: async (path) => {
        await browserPersister?.load();
        const dirPath = normalizeBrowserPath(path);
        const dirRow = rowForPath(dirPath);
        if (!dirRow || dirRow.isDirectory !== 1) {
          throw new Error(`Directory not found: ${dirPath}`);
        }

        const prefix = dirPath === '/' ? '/' : `${dirPath}/`;
        const entries = Object.entries(browserStore?.getTable(FS_TABLE) ?? {})
          .filter(([entryPath]) => entryPath !== dirPath && entryPath.startsWith(prefix))
          .filter(([entryPath]) => {
            const rel = entryPath.slice(prefix.length);
            return rel.length > 0 && !rel.includes('/');
          })
          .map(([entryPath, row]) => {
            const fsRow = row as FsRow;
            return {
              name: fsRow.name ?? baseName(entryPath),
              path: asFilePath(entryPath),
              isDirectory: fsRow.isDirectory === 1,
              size: fsRow.size ?? 0,
              mtime: fsRow.mtime ? new Date(fsRow.mtime) : new Date()
            };
          });

        return entries;
      },
      stat: async (path) => {
        await browserPersister?.load();
        const targetPath = normalizeBrowserPath(path);
        const row = rowForPath(targetPath);
        if (!row) throw new Error(`Path not found: ${targetPath}`);

        return {
          name: row.name ?? baseName(targetPath),
          path: asFilePath(targetPath),
          isDirectory: row.isDirectory === 1,
          size: row.size ?? 0,
          mtime: row.mtime ? new Date(row.mtime) : new Date()
        };
      },
      mkdir: async (path) => {
        const dirPath = normalizeBrowserPath(path);
        ensureDirectoryPath(dirPath);
      },
      rm: async (path) => {
        const targetPath = normalizeBrowserPath(path);
        browserStore?.delRow(FS_TABLE, targetPath);
      },
      exists: async (path) => {
        await browserPersister?.load();
        const targetPath = normalizeBrowserPath(path);
        return Boolean(rowForPath(targetPath));
      }
    };
  }

  return {
    readFile: (path) => browserDriver!.readFile(normalizeBrowserPath(path) as typeof path),
    writeFile: (path, data) => browserDriver!.writeFile(normalizeBrowserPath(path) as typeof path, data),
    readdir: (path) => browserDriver!.readdir(normalizeBrowserPath(path) as typeof path),
    stat: (path) => browserDriver!.stat(normalizeBrowserPath(path) as typeof path),
    mkdir: (path) => browserDriver!.mkdir(normalizeBrowserPath(path) as typeof path),
    rm: (path) => browserDriver!.rm(normalizeBrowserPath(path) as typeof path),
    exists: (path) => browserDriver!.exists(normalizeBrowserPath(path) as typeof path)
  };
};

export const getWatcher = async (): Promise<IWatcherService> => createWatcherService();
