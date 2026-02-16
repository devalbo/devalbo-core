import { promises as fs } from 'node:fs';
import type { DirectoryPath, FilePath, WatchEvent } from '@devalbo/shared';
import { unsafeAsFilePath, WatchEventType } from '@devalbo/shared';
import type { IWatcherService } from '../interfaces';

export class PollingWatcherService implements IWatcherService {
  watch(path: DirectoryPath, callback: (event: WatchEvent) => void): () => void {
    const interval = setInterval(async () => {
      try {
        await fs.readdir(path);
        callback({ type: WatchEventType.Modified, path: unsafeAsFilePath(path), timestamp: new Date() });
      } catch {
        callback({ type: WatchEventType.Deleted, path: unsafeAsFilePath(path), timestamp: new Date() });
      }
    }, 1500);

    return () => clearInterval(interval);
  }

  watchFile(path: FilePath, callback: (event: WatchEvent) => void): () => void {
    const interval = setInterval(async () => {
      try {
        await fs.stat(path);
        callback({ type: WatchEventType.Modified, path, timestamp: new Date() });
      } catch {
        callback({ type: WatchEventType.Deleted, path, timestamp: new Date() });
      }
    }, 1500);

    return () => clearInterval(interval);
  }
}
