import type { DirectoryPath, FilePath, WatchEvent } from '@devalbo/shared';
import type { IWatcherService } from '../interfaces';
import { subscribeBrowserFsEvents } from '../drivers/browser-store';

const normalizePath = (input: string): string => {
  if (input === '' || input === '.') return '/';
  return input.startsWith('/') ? input : `/${input}`;
};

const isSamePath = (left: string, right: string): boolean => normalizePath(left) === normalizePath(right);

const isWithinDirectory = (targetPath: string, directoryPath: string): boolean => {
  const normalizedTarget = normalizePath(targetPath);
  const normalizedDirectory = normalizePath(directoryPath);
  if (normalizedDirectory === '/') return normalizedTarget.startsWith('/');
  return normalizedTarget === normalizedDirectory || normalizedTarget.startsWith(`${normalizedDirectory}/`);
};

export class BrowserWatcherService implements IWatcherService {
  watch(path: DirectoryPath, callback: (event: WatchEvent) => void): () => void {
    return subscribeBrowserFsEvents((event) => {
      if (isWithinDirectory(event.path, path)) {
        callback(event);
      }
    });
  }

  watchFile(path: FilePath, callback: (event: WatchEvent) => void): () => void {
    return subscribeBrowserFsEvents((event) => {
      if (isSamePath(event.path, path) || (event.oldPath != null && isSamePath(event.oldPath, path))) {
        callback(event);
      }
    });
  }
}
