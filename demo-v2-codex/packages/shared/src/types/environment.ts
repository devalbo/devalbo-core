export enum RuntimePlatform {
  NodeJS = 'nodejs',
  Browser = 'browser',
  Worker = 'worker',
  Tauri = 'tauri'
}

export interface RuntimeEnv {
  platform: RuntimePlatform;
  hasSharedArrayBuffer: boolean;
  hasOPFS: boolean;
  hasFSWatch: boolean;
}

export interface IConnectivityService {
  isOnline(): boolean;
  onOnline(callback: () => void): () => void;
}

export class AlwaysOnlineConnectivityService implements IConnectivityService {
  isOnline(): boolean {
    return true;
  }

  onOnline(): () => void {
    return () => {};
  }
}

export class BrowserConnectivityService implements IConnectivityService {
  isOnline(): boolean {
    const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
    return nav?.onLine ?? true;
  }

  onOnline(callback: () => void): () => void {
    const win = globalThis as { addEventListener?: (event: string, cb: () => void) => void; removeEventListener?: (event: string, cb: () => void) => void };
    if (!win.addEventListener || !win.removeEventListener) return () => {};
    win.addEventListener('online', callback);
    return () => win.removeEventListener?.('online', callback);
  }
}
