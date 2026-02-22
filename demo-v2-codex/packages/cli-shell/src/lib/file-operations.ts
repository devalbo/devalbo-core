import {
  createFilesystemDriver,
  createWatcherService,
  getFilesystemBackendInfo as getFilesystemBackendInfoFromDriver,
  type FilesystemBackendInfo,
  type IFilesystemDriver,
  type IWatcherService
} from '@devalbo/filesystem';

let driverPromise: Promise<IFilesystemDriver> | undefined;

export { FS_STORAGE_KEY } from '@devalbo/filesystem';

export const getDriver = async (): Promise<IFilesystemDriver> => {
  if (!driverPromise) {
    driverPromise = createFilesystemDriver();
  }
  return driverPromise;
};

export const getWatcher = async (): Promise<IWatcherService> => createWatcherService();

export const getFilesystemBackendInfo = async (): Promise<FilesystemBackendInfo> =>
  getFilesystemBackendInfoFromDriver();
