import { detectPlatform, RuntimePlatform } from '@devalbo/shared';
import { ZenFSDriver, createWatcherService, type IFilesystemDriver, type IWatcherService } from '@devalbo/filesystem';

export const getDriver = async (): Promise<IFilesystemDriver> => {
  const env = detectPlatform();
  if (env.platform === RuntimePlatform.NodeJS) {
    const { NativeFSDriver } = await import('@devalbo/filesystem/node');
    return new NativeFSDriver();
  }
  return new ZenFSDriver();
};

export const getWatcher = async (): Promise<IWatcherService> => createWatcherService();
