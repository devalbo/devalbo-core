import { watch } from 'node:fs';
import path from 'node:path';
import type { DirectoryPath, FilePath, WatchEvent } from '@devalbo/shared';
import { asFilePath, WatchEventType } from '@devalbo/shared';
import type { IWatcherService } from '../interfaces';

export class NodeWatcherService implements IWatcherService {
  watch(target: DirectoryPath, callback: (event: WatchEvent) => void): () => void {
    const watcher = watch(target, (_eventType, filename) => {
      if (!filename) return;
      callback({
        type: WatchEventType.Modified,
        path: asFilePath(path.join(target, filename.toString())),
        timestamp: new Date()
      });
    });

    return () => watcher.close();
  }

  watchFile(target: FilePath, callback: (event: WatchEvent) => void): () => void {
    const watcher = watch(target, () => {
      callback({
        type: WatchEventType.Modified,
        path: target,
        timestamp: new Date()
      });
    });

    return () => watcher.close();
  }
}
