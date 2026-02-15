import { detectPlatform, RuntimePlatform } from '@devalbo/shared';
import type { IWatcherService } from '../interfaces';
import { BrowserWatcherService } from './browser-watcher';

export const createWatcherService = async (): Promise<IWatcherService> => {
  const env = detectPlatform();
  if (env.platform === RuntimePlatform.NodeJS) {
    const { NodeWatcherService } = await import(/* @vite-ignore */ '@devalbo/filesystem/node');
    return new NodeWatcherService();
  }
  return new BrowserWatcherService();
};
