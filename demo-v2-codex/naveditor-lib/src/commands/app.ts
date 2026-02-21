import type { AsyncCommandHandler } from './_util';
import { makeOutput } from './_util';

export const appCommands: Record<'app-config', AsyncCommandHandler> = {
  'app-config': async (_args, options) => {
    if (!options?.config) {
      return makeOutput('App config is not available in this runtime context.');
    }

    const { config } = options;
    return makeOutput(
      [
        `appId: ${config.appId}`,
        `appName: ${config.appName}`,
        `storageKey: ${config.storageKey}`,
        `podNamespace: ${config.podNamespace}`,
        `socialLocalPath: ${config.socialLocalPath}`,
        `sync.social.pollIntervalMs: ${config.sync.social.pollIntervalMs}`,
        `sync.social.outboundDebounceMs: ${config.sync.social.outboundDebounceMs}`,
        `sync.files.pollIntervalMs: ${config.sync.files.pollIntervalMs}`,
        `sync.files.outboundDebounceMs: ${config.sync.files.outboundDebounceMs}`,
        `sync.files.maxFileSizeBytes: ${config.sync.files.maxFileSizeBytes}`,
        `features.socialSync: ${config.features.socialSync}`,
        `features.fileSync: ${config.features.fileSync}`,
        `features.fileSharing: ${config.features.fileSharing}`
      ].join('\n')
    );
  }
};
