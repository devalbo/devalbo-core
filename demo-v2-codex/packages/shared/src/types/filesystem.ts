import type { FilePath } from './branded';

export interface FileEntry {
  name: string;
  path: FilePath;
  isDirectory: boolean;
  size?: number;
  mtime?: Date;
}

export enum WatchEventType {
  Created = 'created',
  Modified = 'modified',
  Deleted = 'deleted',
  Moved = 'moved'
}

export interface WatchEvent {
  type: WatchEventType;
  path: FilePath;
  oldPath?: FilePath;
  timestamp: Date;
}
