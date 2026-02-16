import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DirectoryPath, FileEntry, FilePath } from '@devalbo/shared';
import { unsafeAsFilePath } from '@devalbo/shared';
import type { IFilesystemDriver } from '../interfaces';

function toEntry(fullPath: string, stats: Awaited<ReturnType<typeof fs.stat>>): FileEntry {
  return {
    name: path.basename(fullPath),
    path: unsafeAsFilePath(fullPath),
    isDirectory: stats.isDirectory(),
    size: Number(stats.size),
    mtime: stats.mtime
  };
}

export class NativeFSDriver implements IFilesystemDriver {
  async readFile(filePath: FilePath): Promise<Uint8Array> {
    const buffer = await fs.readFile(filePath);
    return new Uint8Array(buffer);
  }

  async writeFile(filePath: FilePath, data: Uint8Array): Promise<void> {
    await fs.writeFile(filePath, data);
  }

  async readdir(dirPath: DirectoryPath): Promise<FileEntry[]> {
    const names = await fs.readdir(dirPath);
    return Promise.all(
      names.map(async (name) => {
        const fullPath = path.join(dirPath, name);
        const stats = await fs.stat(fullPath);
        return toEntry(fullPath, stats);
      })
    );
  }

  async stat(filePath: FilePath): Promise<FileEntry> {
    const stats = await fs.stat(filePath);
    return toEntry(filePath, stats);
  }

  async mkdir(dirPath: DirectoryPath): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async rm(filePath: FilePath): Promise<void> {
    await fs.rm(filePath, { recursive: true, force: true });
  }

  async exists(filePath: FilePath): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
