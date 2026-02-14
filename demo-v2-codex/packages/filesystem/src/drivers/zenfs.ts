import type { DirectoryPath, FileEntry, FilePath } from '@devalbo/shared';
import type { IFilesystemDriver } from '../interfaces';

export class ZenFSDriver implements IFilesystemDriver {
  async readFile(_path: FilePath): Promise<Uint8Array> {
    throw new Error('ZenFSDriver is not implemented yet');
  }

  async writeFile(_path: FilePath, _data: Uint8Array): Promise<void> {
    throw new Error('ZenFSDriver is not implemented yet');
  }

  async readdir(_path: DirectoryPath): Promise<FileEntry[]> {
    throw new Error('ZenFSDriver is not implemented yet');
  }

  async stat(_path: FilePath): Promise<FileEntry> {
    throw new Error('ZenFSDriver is not implemented yet');
  }

  async mkdir(_path: DirectoryPath): Promise<void> {
    throw new Error('ZenFSDriver is not implemented yet');
  }

  async rm(_path: FilePath): Promise<void> {
    throw new Error('ZenFSDriver is not implemented yet');
  }

  async exists(_path: FilePath): Promise<boolean> {
    throw new Error('ZenFSDriver is not implemented yet');
  }
}
