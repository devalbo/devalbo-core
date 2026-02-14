import type { DirectoryPath, FilePath, FileEntry, WatchEvent } from '@devalbo/shared';

export interface IFilesystemDriver {
  readFile(path: FilePath): Promise<Uint8Array>;
  writeFile(path: FilePath, data: Uint8Array): Promise<void>;
  readdir(path: DirectoryPath): Promise<FileEntry[]>;
  stat(path: FilePath): Promise<FileEntry>;
  mkdir(path: DirectoryPath): Promise<void>;
  rm(path: FilePath): Promise<void>;
  exists(path: FilePath): Promise<boolean>;
}

export interface IWatcherService {
  watch(path: DirectoryPath, callback: (event: WatchEvent) => void): () => void;
  watchFile(path: FilePath, callback: (event: WatchEvent) => void): () => void;
}
