import path from 'node:path';
import type { DirectoryPath, FileEntry, FilePath } from '@devalbo/shared';
import { asFilePath } from '@devalbo/shared';
import type { IFilesystemDriver } from '../interfaces';

interface MemoryNode {
  data: Uint8Array;
  isDirectory: boolean;
  mtime: Date;
}

export class InMemoryDriver implements IFilesystemDriver {
  private nodes = new Map<string, MemoryNode>();

  constructor(seed: Record<string, string> = {}) {
    this.nodes.set('/', { data: new Uint8Array(), isDirectory: true, mtime: new Date() });
    for (const [filePath, content] of Object.entries(seed)) {
      this.nodes.set(filePath, { data: new TextEncoder().encode(content), isDirectory: false, mtime: new Date() });
    }
  }

  async readFile(filePath: FilePath): Promise<Uint8Array> {
    const node = this.nodes.get(filePath);
    if (!node || node.isDirectory) {
      throw new Error(`File not found: ${filePath}`);
    }
    return node.data;
  }

  async writeFile(filePath: FilePath, data: Uint8Array): Promise<void> {
    this.nodes.set(filePath, { data, isDirectory: false, mtime: new Date() });
  }

  async readdir(dirPath: DirectoryPath): Promise<FileEntry[]> {
    const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const entries: FileEntry[] = [];

    for (const [nodePath, node] of this.nodes.entries()) {
      if (!nodePath.startsWith(prefix) || nodePath === dirPath) continue;
      const rel = nodePath.slice(prefix.length);
      if (rel.includes('/')) continue;
      entries.push({
        name: path.basename(nodePath),
        path: asFilePath(nodePath),
        isDirectory: node.isDirectory,
        size: node.data.length,
        mtime: node.mtime
      });
    }

    return entries;
  }

  async stat(filePath: FilePath): Promise<FileEntry> {
    const node = this.nodes.get(filePath);
    if (!node) {
      throw new Error(`Path not found: ${filePath}`);
    }
    return {
      name: path.basename(filePath),
      path: asFilePath(filePath),
      isDirectory: node.isDirectory,
      size: node.data.length,
      mtime: node.mtime
    };
  }

  async mkdir(dirPath: DirectoryPath): Promise<void> {
    this.nodes.set(dirPath, { data: new Uint8Array(), isDirectory: true, mtime: new Date() });
  }

  async rm(filePath: FilePath): Promise<void> {
    this.nodes.delete(filePath);
  }

  async exists(filePath: FilePath): Promise<boolean> {
    return this.nodes.has(filePath);
  }
}
