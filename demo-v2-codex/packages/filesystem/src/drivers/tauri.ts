import path from 'path';
import { asFilePath, type DirectoryPath, type FileEntry, type FilePath } from '@devalbo/shared';
import type { IFilesystemDriver } from '../interfaces';

type TauriFsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtimeMs: number | null;
};

let tauriInvoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

const getInvoke = async () => {
  if (tauriInvoke) return tauriInvoke;
  const mod = await import('@tauri-apps/api/core');
  tauriInvoke = mod.invoke;
  return tauriInvoke;
};

const normalizeVirtualPath = (value: string): string => {
  if (!value || value === '.') return '/';
  if (value.startsWith('/')) return value;
  return `/${value}`;
};

export class TauriFSDriver implements IFilesystemDriver {
  private baseDirPromise: Promise<string> | undefined;

  private async getBaseDir(): Promise<string> {
    if (!this.baseDirPromise) {
      this.baseDirPromise = (async () => {
        const invoke = await getInvoke();
        const cwd = await invoke<string>('fs_get_base_dir');
        return cwd;
      })();
    }
    return this.baseDirPromise;
  }

  private async toRealPath(input: string): Promise<string> {
    const base = await this.getBaseDir();
    const normalized = normalizeVirtualPath(input);
    if (normalized === '/') return base;
    const relative = normalized.slice(1);
    return path.join(base, relative);
  }

  private async toFileEntry(entry: TauriFsEntry): Promise<FileEntry> {
    const base = await this.getBaseDir();
    const rel = path.relative(base, entry.path);
    const virtualPath = rel ? `/${rel.split(path.sep).join('/')}` : '/';
    return {
      name: entry.name,
      path: asFilePath(virtualPath),
      isDirectory: entry.isDirectory,
      size: entry.size,
      mtime: entry.mtimeMs ? new Date(entry.mtimeMs) : new Date()
    };
  }

  async readFile(filePath: FilePath): Promise<Uint8Array> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(filePath);
    const bytes = await invoke<number[]>('fs_read_file', { path: realPath });
    return new Uint8Array(bytes);
  }

  async writeFile(filePath: FilePath, data: Uint8Array): Promise<void> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(filePath);
    await invoke('fs_write_file', { path: realPath, data: Array.from(data) });
  }

  async readdir(dirPath: DirectoryPath): Promise<FileEntry[]> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(dirPath);
    const entries = await invoke<TauriFsEntry[]>('fs_readdir', { path: realPath });
    return Promise.all(entries.map((entry) => this.toFileEntry(entry)));
  }

  async stat(filePath: FilePath): Promise<FileEntry> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(filePath);
    const entry = await invoke<TauriFsEntry>('fs_stat', { path: realPath });
    return this.toFileEntry(entry);
  }

  async mkdir(dirPath: DirectoryPath): Promise<void> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(dirPath);
    await invoke('fs_mkdir', { path: realPath });
  }

  async rm(filePath: FilePath): Promise<void> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(filePath);
    await invoke('fs_rm', { path: realPath });
  }

  async exists(filePath: FilePath): Promise<boolean> {
    const invoke = await getInvoke();
    const realPath = await this.toRealPath(filePath);
    return invoke<boolean>('fs_exists', { path: realPath });
  }

  async getBackendInfo(): Promise<{ adapter: 'tauri'; baseDir: string }> {
    return {
      adapter: 'tauri',
      baseDir: await this.getBaseDir()
    };
  }
}
