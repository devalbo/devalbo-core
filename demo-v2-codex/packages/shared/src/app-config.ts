import { ByteCountSchema, MillisecondsSchema, type ByteCount, type Milliseconds } from './types/branded';

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

type AppIdentity = {
  appId: string;
  appName: string;
  storageKey: string;
};

/** CLI-only app: all sync and social features disabled. */
export const createCliAppConfig = (identity: AppIdentity): AppConfig => ({
  ...identity,
  podNamespace: '',
  socialLocalPath: '',
  sync: {
    social: {
      pollIntervalMs: MillisecondsSchema.parse(0),
      outboundDebounceMs: MillisecondsSchema.parse(0)
    },
    files: {
      pollIntervalMs: MillisecondsSchema.parse(0),
      outboundDebounceMs: MillisecondsSchema.parse(0),
      maxFileSizeBytes: ByteCountSchema.parse(0)
    }
  },
  features: { socialSync: false, fileSync: false, fileSharing: false }
});

/** Browser or desktop app with full Solid sync enabled. */
export const createSocialAppConfig = (
  identity: AppIdentity,
  opts: { podNamespace: string; socialLocalPath: string }
): AppConfig => ({
  ...identity,
  podNamespace: opts.podNamespace,
  socialLocalPath: opts.socialLocalPath,
  sync: {
    social: {
      pollIntervalMs: MillisecondsSchema.parse(30_000),
      outboundDebounceMs: MillisecondsSchema.parse(2_000)
    },
    files: {
      pollIntervalMs: MillisecondsSchema.parse(60_000),
      outboundDebounceMs: MillisecondsSchema.parse(5_000),
      maxFileSizeBytes: ByteCountSchema.parse(10_485_760)
    }
  },
  features: { socialSync: true, fileSync: true, fileSharing: true }
});
