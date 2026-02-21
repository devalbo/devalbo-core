import type { AppConfig } from '@devalbo/shared';
import { unsafeAsByteCount, unsafeAsMilliseconds } from '@devalbo/shared';

export const defaultAppConfig: AppConfig = {
  appId: 'naveditor',
  appName: 'naveditor',
  storageKey: 'devalbo-store',
  podNamespace: 'devalbo',
  socialLocalPath: '/_social/',
  sync: {
    social: {
      pollIntervalMs: unsafeAsMilliseconds(30_000),
      outboundDebounceMs: unsafeAsMilliseconds(1_000)
    },
    files: {
      pollIntervalMs: unsafeAsMilliseconds(30_000),
      outboundDebounceMs: unsafeAsMilliseconds(1_500),
      maxFileSizeBytes: unsafeAsByteCount(5 * 1024 * 1024)
    }
  },
  features: {
    socialSync: true,
    fileSync: false,
    fileSharing: false
  }
};
