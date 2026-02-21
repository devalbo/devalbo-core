import type { ByteCount, Milliseconds } from './types/branded';

export type AppConfig = {
  appId: string;
  appName: string;
  storageKey: string;
  podNamespace: string;
  socialLocalPath: string;
  sync: {
    social: {
      pollIntervalMs: Milliseconds;
      outboundDebounceMs: Milliseconds;
    };
    files: {
      pollIntervalMs: Milliseconds;
      outboundDebounceMs: Milliseconds;
      maxFileSizeBytes: ByteCount;
    };
  };
  features: {
    socialSync: boolean;
    fileSync: boolean;
    fileSharing: boolean;
  };
};
