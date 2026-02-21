import type { Store } from 'tinybase';
import type { IFilesystemDriver, IWatcherService } from '@devalbo/filesystem';
import type { AbsolutePath, AppConfig, IConnectivityService, SyncRoot, WatchEvent } from '@devalbo/shared';
import { WatchEventType } from '@devalbo/shared';
import { pushFilesForRoot, pullFilesForRoot, resolveFileConflict, type FileSyncSummary } from './ldp-file-sync-ops';

export class SolidLdpFileSynchronizer {
  private unwatch: (() => void) | null = null;
  private onlineUnsubscribe: (() => void) | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private suppressOutbound = false;
  private readonly outboundTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly root: SyncRoot,
    private readonly allRoots: SyncRoot[],
    private readonly session: { fetch: typeof fetch },
    private readonly store: Store,
    private readonly driver: IFilesystemDriver,
    private readonly watcher: IWatcherService,
    private readonly syncConfig: AppConfig['sync']['files'],
    private readonly connectivity: IConnectivityService
  ) {
    const conflicts = allRoots.filter((r) =>
      r.id !== root.id && (r.localPath.startsWith(root.localPath) || root.localPath.startsWith(r.localPath))
    );
    if (conflicts.length > 0) {
      const detail = conflicts.map((r) => `"${r.id}" at "${r.localPath}"`).join(', ');
      console.error(
        `[SolidLdpFileSynchronizer] root "${root.id}" (${root.localPath}) conflicts with: ${detail}. This synchronizer will not start.`
      );
      throw new Error(`SyncRoot conflict: ${root.id}`);
    }
  }

  start(): void {
    if (!this.root.enabled) return;
    this.unwatch = this.watcher.watch(this.root.localPath, this.handleWatchEvent);
    this.pollIntervalId = setInterval(() => void this.poll(), this.syncConfig.pollIntervalMs);
    this.onlineUnsubscribe = this.connectivity.onOnline(() => {
      void this.flushQueue();
    });
  }

  stop(): void {
    this.unwatch?.();
    this.unwatch = null;
    this.onlineUnsubscribe?.();
    this.onlineUnsubscribe = null;
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = null;
    for (const timer of this.outboundTimers.values()) clearTimeout(timer);
    this.outboundTimers.clear();
  }

  async pushAll(): Promise<FileSyncSummary> {
    return pushFilesForRoot(this.root, this.store, this.driver, this.session.fetch, this.connectivity);
  }

  async pullAll(): Promise<FileSyncSummary> {
    this.suppressOutbound = true;
    try {
      return await pullFilesForRoot(this.root, this.store, this.driver, this.session.fetch);
    } finally {
      this.suppressOutbound = false;
    }
  }

  async resolveConflict(path: AbsolutePath, resolution: 'keep-local' | 'keep-pod' | 'keep-both'): Promise<void> {
    await resolveFileConflict(path, resolution, this.root, this.store, this.driver, this.session.fetch);
  }

  private handleWatchEvent = (event: WatchEvent): void => {
    if (this.root.readonly || this.suppressOutbound) return;
    if (event.type !== WatchEventType.Created && event.type !== WatchEventType.Modified && event.type !== WatchEventType.Deleted) {
      return;
    }

    const existing = this.outboundTimers.get(event.path);
    if (existing) clearTimeout(existing);
    const timerId = setTimeout(() => {
      this.outboundTimers.delete(event.path);
      void this.flushQueue();
    }, this.syncConfig.outboundDebounceMs);
    this.outboundTimers.set(event.path, timerId);
  };

  private async poll(): Promise<void> {
    try {
      await this.pullAll();
    } catch (error) {
      console.warn('[SolidLdpFileSynchronizer] poll failed:', error);
    }
  }

  private async flushQueue(): Promise<void> {
    try {
      await this.pushAll();
    } catch (error) {
      console.warn('[SolidLdpFileSynchronizer] flushQueue failed:', error);
    }
  }
}
