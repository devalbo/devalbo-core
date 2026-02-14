import type { IWatcherService } from './interfaces';
import { BrowserWatcherService } from './watcher/browser-watcher';

export * from './interfaces';
export * from './drivers/memory';
export * from './drivers/zenfs';
export * from './watcher/events';
export * from './watcher/browser-watcher';

export const createWatcherService = (): IWatcherService => new BrowserWatcherService();
