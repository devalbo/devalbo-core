import type { IWatcherService } from './interfaces';
import { BrowserWatcherService } from './watcher/browser-watcher';
import { BrowserStoreFSDriver } from './drivers/browser-store';
import type { IFilesystemDriver } from './interfaces';

export * from './interfaces';
export * from './drivers/memory';
export * from './drivers/zenfs';
export * from './drivers/browser-store';
export * from './watcher/events';
export * from './watcher/browser-watcher';

export const createWatcherService = (): IWatcherService => new BrowserWatcherService();
export const createFilesystemDriver = async (): Promise<IFilesystemDriver> => new BrowserStoreFSDriver();
