import type { DirectoryPath, FilePath, WatchEvent } from '@devalbo/shared';
import type { IWatcherService } from '../interfaces';

export class BrowserWatcherService implements IWatcherService {
  watch(_path: DirectoryPath, _callback: (event: WatchEvent) => void): () => void {
    return () => {};
  }

  watchFile(_path: FilePath, _callback: (event: WatchEvent) => void): () => void {
    return () => {};
  }
}
