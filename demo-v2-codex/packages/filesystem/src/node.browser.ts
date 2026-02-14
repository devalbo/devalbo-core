import type { DirectoryPath, FileEntry, FilePath, WatchEvent } from '@devalbo/shared';
import type { IFilesystemDriver, IWatcherService } from './interfaces';

export class NativeFSDriver implements IFilesystemDriver {
  private unsupported(): never {
    throw new Error('NativeFSDriver is not available in browser builds');
  }

  readFile(_path: FilePath): Promise<Uint8Array> {
    return Promise.reject(this.unsupported());
  }

  writeFile(_path: FilePath, _data: Uint8Array): Promise<void> {
    return Promise.reject(this.unsupported());
  }

  readdir(_path: DirectoryPath): Promise<FileEntry[]> {
    return Promise.reject(this.unsupported());
  }

  stat(_path: FilePath): Promise<FileEntry> {
    return Promise.reject(this.unsupported());
  }

  mkdir(_path: DirectoryPath): Promise<void> {
    return Promise.reject(this.unsupported());
  }

  rm(_path: FilePath): Promise<void> {
    return Promise.reject(this.unsupported());
  }

  exists(_path: FilePath): Promise<boolean> {
    return Promise.reject(this.unsupported());
  }
}

class NoopWatcher implements IWatcherService {
  watch(_path: DirectoryPath, _callback: (event: WatchEvent) => void): () => void {
    return () => {};
  }

  watchFile(_path: FilePath, _callback: (event: WatchEvent) => void): () => void {
    return () => {};
  }
}

export class NodeWatcherService extends NoopWatcher {}
export class PollingWatcherService extends NoopWatcher {}
