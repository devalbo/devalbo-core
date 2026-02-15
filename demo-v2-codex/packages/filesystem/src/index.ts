import { detectPlatform, RuntimePlatform } from '@devalbo/shared';
import type { IFilesystemDriver } from './interfaces';

export * from './interfaces';
export * from './drivers/memory';
export * from './drivers/zenfs';
export * from './drivers/browser-store';
export * from './watcher/events';
export * from './watcher/service';
export * from './watcher/browser-watcher';

let driverPromise: Promise<IFilesystemDriver> | undefined;

export type FilesystemBackendInfo = {
  platform: RuntimePlatform;
  adapter: 'native-node' | 'tauri' | 'browser-store';
  persistence?: 'opfs' | 'indexeddb' | 'localStorage';
  baseDir?: string;
};

export const createFilesystemDriver = async (): Promise<IFilesystemDriver> => {
  if (driverPromise) return driverPromise;

  driverPromise = (async () => {
    const env = detectPlatform();
    if (env.platform === RuntimePlatform.NodeJS) {
      const { NativeFSDriver } = await import(/* @vite-ignore */ '@devalbo/filesystem/node');
      return new NativeFSDriver();
    }
    if (env.platform === RuntimePlatform.Tauri) {
      const { TauriFSDriver } = await import('./drivers/tauri');
      return new TauriFSDriver();
    }
    const { BrowserStoreFSDriver } = await import('./drivers/browser-store');
    return new BrowserStoreFSDriver();
  })();

  return driverPromise;
};

export const getFilesystemBackendInfo = async (): Promise<FilesystemBackendInfo> => {
  const env = detectPlatform();
  const driver = await createFilesystemDriver();

  if (env.platform === RuntimePlatform.NodeJS) {
    return {
      platform: env.platform,
      adapter: 'native-node'
    };
  }

  if (env.platform === RuntimePlatform.Tauri) {
    const tauriDriver = driver as IFilesystemDriver & {
      getBackendInfo?: () => Promise<{ adapter: 'tauri'; baseDir: string }>;
    };
    const info = await tauriDriver.getBackendInfo?.();
    const out: FilesystemBackendInfo = {
      platform: env.platform,
      adapter: info?.adapter ?? 'tauri'
    };
    if (info?.baseDir) out.baseDir = info.baseDir;
    return out;
  }

  const browserDriver = driver as IFilesystemDriver & {
    getBackendInfo?: () => Promise<{ adapter: 'browser-store'; persistence: 'opfs' | 'indexeddb' | 'localStorage' }>;
  };
  const info = await browserDriver.getBackendInfo?.();
  const out: FilesystemBackendInfo = {
    platform: env.platform,
    adapter: info?.adapter ?? 'browser-store'
  };
  if (info?.persistence) out.persistence = info.persistence;
  return out;
};
