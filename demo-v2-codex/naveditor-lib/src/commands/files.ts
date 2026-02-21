import type { Store } from 'tinybase';
import {
  deleteFileSyncState,
  deleteSyncRoot,
  getFileSyncState,
  getSyncRoot,
  listFileSyncStatesForRoot,
  listSyncRoots,
  setSyncRoot
} from '@devalbo/state';
import {
  AlwaysOnlineConnectivityService,
  assertAbsolutePath,
  assertPodUrl,
  assertSyncRootId,
  assertWebId,
  type SyncRoot
} from '@devalbo/shared';
import {
  SolidLdpFilePersister,
  findRootConflicts,
  findSyncRoot,
  pullFilesForRoot,
  pushFilesForRoot,
  resolveFileConflict
} from '@devalbo/solid-client';
import { makeOutput, makeResultError, type AsyncCommandHandler, type ExtendedCommandOptions } from './_util';

const hasStore = (options?: ExtendedCommandOptions): options is ExtendedCommandOptions & { store: Store } =>
  typeof options === 'object' && options != null && 'store' in options;

const parseFlagValue = (args: string[], name: string): string | null => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const formatRoot = (root: SyncRoot, store: Store): string => {
  const states = listFileSyncStatesForRoot(store, root.id);
  const pending = states.filter((s) => s.status === 'pending_upload' || s.status === 'pending_delete').length;
  const conflicts = states.filter((s) => s.status === 'conflict').length;
  return `${root.id.slice(0, 8)}  ${root.label || '-'}  ${root.localPath} -> ${root.podUrl}  enabled=${root.enabled} readonly=${root.readonly} pending=${pending} conflicts=${conflicts}`;
};

const deleteFileSyncStatesForRoot = (store: Store, rootId: SyncRoot['id']): void => {
  const states = listFileSyncStatesForRoot(store, rootId);
  for (const state of states) {
    deleteFileSyncState(store, state.path);
  }
};

export const filesCommands: Record<
  | 'files-root-add'
  | 'files-root-list'
  | 'files-root-enable'
  | 'files-root-disable'
  | 'files-root-remove'
  | 'files-push'
  | 'files-pull'
  | 'files-status'
  | 'files-resolve',
  AsyncCommandHandler
> = {
  'files-root-add': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-root-add requires a store');
    if (args.length < 2) {
      return makeResultError('Usage: files-root-add <localPath> <podUrl> [--label <label>] [--readonly] [--web-id <webId>]');
    }

    const localPath = args[0]!;
    const podUrl = args[1]!;
    if (!localPath.endsWith('/')) {
      return makeResultError(`Error: localPath "${localPath}" must end with "/". Did you mean "${localPath}/"?`);
    }
    if (!podUrl.endsWith('/')) {
      return makeResultError(`Error: podUrl "${podUrl}" must end with "/".`);
    }

    if (options.config?.socialLocalPath && (
      localPath.startsWith(options.config.socialLocalPath) || options.config.socialLocalPath.startsWith(localPath)
    )) {
      return makeResultError(
        `Error: localPath "${localPath}" overlaps with the reserved social data path (${options.config.socialLocalPath}).`
      );
    }

    let parsedPodUrl: ReturnType<typeof assertPodUrl>;
    try {
      parsedPodUrl = assertPodUrl(podUrl);
    } catch (error) {
      return makeResultError(error instanceof Error ? error.message : String(error));
    }

    const socialPodBase = options.config
      ? `${new URL(parsedPodUrl).origin}/${options.config.podNamespace}/`
      : null;
    const fileSyncBase = options.config
      ? `${new URL(parsedPodUrl).origin}/${options.config.podNamespace}/files/`
      : null;
    if (socialPodBase && fileSyncBase && parsedPodUrl.startsWith(socialPodBase) && !parsedPodUrl.startsWith(fileSyncBase)) {
      return makeResultError(
        `Error: podUrl "${parsedPodUrl}" overlaps with the app's social data namespace. Use "${fileSyncBase}" (or a sub-container of it) for file sync, or a container outside "${socialPodBase}" entirely.`
      );
    }

    const existing = listSyncRoots(options.store);
    const parsedWebId = parseFlagValue(args, '--web-id');
    const label = parseFlagValue(args, '--label') ?? '';
    const readonly = hasFlag(args, '--readonly');
    const defaultWebId = options.session?.webId ?? '';
    const webIdRaw = parsedWebId ?? defaultWebId;
    if (!webIdRaw) return makeResultError('No WebID available. Provide --web-id or login first.');

    const newRoot: SyncRoot = {
      id: assertSyncRootId(crypto.randomUUID()),
      label,
      localPath: localPath as SyncRoot['localPath'],
      podUrl: parsedPodUrl,
      webId: assertWebId(webIdRaw),
      readonly,
      enabled: true
    };

    const conflicts = findRootConflicts([...existing, newRoot]);
    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      if (!firstConflict) return makeResultError('Error: sync root conflict detected.');
      const [a, b] = firstConflict;
      if (a.id === newRoot.id) {
        return makeResultError(`Error: localPath "${newRoot.localPath}" overlaps with existing root "${b.label || b.id}" ("${b.localPath}").`);
      }
      return makeResultError(`Error: localPath "${newRoot.localPath}" overlaps with existing root "${a.label || a.id}" ("${a.localPath}").`);
    }

    setSyncRoot(options.store, newRoot);
    return makeOutput(`Added sync root ${newRoot.id}`);
  },

  'files-root-list': async (_args, options) => {
    if (!hasStore(options)) return makeResultError('files-root-list requires a store');
    const roots = listSyncRoots(options.store);
    if (roots.length === 0) return makeOutput('No sync roots configured.');
    return makeOutput(roots.map((root) => formatRoot(root, options.store)).join('\n'));
  },

  'files-root-enable': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-root-enable requires a store');
    if (args.length < 1) return makeResultError('Usage: files-root-enable <rootId>');
    let id: SyncRoot['id'];
    try {
      id = assertSyncRootId(args[0]!);
    } catch (error) {
      return makeResultError(error instanceof Error ? error.message : String(error));
    }
    const root = getSyncRoot(options.store, id);
    if (!root) return makeResultError(`Sync root not found: ${id}`);
    setSyncRoot(options.store, { ...root, enabled: true });
    return makeOutput(`Enabled sync root ${id}`);
  },

  'files-root-disable': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-root-disable requires a store');
    if (args.length < 1) return makeResultError('Usage: files-root-disable <rootId>');
    let id: SyncRoot['id'];
    try {
      id = assertSyncRootId(args[0]!);
    } catch (error) {
      return makeResultError(error instanceof Error ? error.message : String(error));
    }
    const root = getSyncRoot(options.store, id);
    if (!root) return makeResultError(`Sync root not found: ${id}`);
    setSyncRoot(options.store, { ...root, enabled: false });
    return makeOutput(`Disabled sync root ${id}`);
  },

  'files-root-remove': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-root-remove requires a store');
    if (args.length < 2) return makeResultError('Usage: files-root-remove <rootId> <keep-pod|delete-from-pod>');
    const rootIdRaw = args[0]!;
    const mode = args[1]!;
    if (mode !== 'keep-pod' && mode !== 'delete-from-pod') {
      return makeResultError('Second argument must be keep-pod or delete-from-pod');
    }
    let rootId: SyncRoot['id'];
    try {
      rootId = assertSyncRootId(rootIdRaw);
    } catch (error) {
      return makeResultError(error instanceof Error ? error.message : String(error));
    }
    const root = getSyncRoot(options.store, rootId);
    if (!root) return makeResultError(`Sync root not found: ${rootId}`);

    if (mode === 'delete-from-pod') {
      if (!options.session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
      const persister = new SolidLdpFilePersister(root.podUrl, options.session.fetch);
      await persister.deleteAll();
    }

    deleteFileSyncStatesForRoot(options.store, rootId);
    deleteSyncRoot(options.store, rootId);
    return makeOutput(`Removed sync root ${rootId}`);
  },

  'files-push': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-push requires a store');
    if (!options?.session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
    if (!options.driver) return makeResultError('files-push requires a filesystem driver');
    const rootFlag = parseFlagValue(args, '--root');
    const roots = listSyncRoots(options.store).filter((root) => root.enabled);
    const selected = rootFlag ? roots.filter((root) => root.id === rootFlag) : roots;
    if (selected.length === 0) return makeOutput('No enabled sync roots to push.');
    const connectivity = options.connectivity ?? new AlwaysOnlineConnectivityService();
    const lines: string[] = [];
    for (const root of selected) {
      const result = await pushFilesForRoot(root, options.store, options.driver, options.session.fetch, connectivity);
      lines.push(`${root.id.slice(0, 8)} uploaded=${result.uploaded} conflicts=${result.conflicts} errors=${result.errors.length}`);
    }
    return makeOutput(lines.join('\n'));
  },

  'files-pull': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-pull requires a store');
    if (!options?.session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
    if (!options.driver) return makeResultError('files-pull requires a filesystem driver');
    const rootFlag = parseFlagValue(args, '--root');
    const roots = listSyncRoots(options.store).filter((root) => root.enabled);
    const selected = rootFlag ? roots.filter((root) => root.id === rootFlag) : roots;
    if (selected.length === 0) return makeOutput('No enabled sync roots to pull.');
    const lines: string[] = [];
    for (const root of selected) {
      const result = await pullFilesForRoot(root, options.store, options.driver, options.session.fetch);
      lines.push(`${root.id.slice(0, 8)} downloaded=${result.downloaded} conflicts=${result.conflicts} errors=${result.errors.length}`);
    }
    return makeOutput(lines.join('\n'));
  },

  'files-status': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-status requires a store');
    const rootFlag = parseFlagValue(args, '--root');
    const roots = listSyncRoots(options.store);
    const selected = rootFlag ? roots.filter((root) => root.id === rootFlag) : roots;
    if (selected.length === 0) return makeOutput('No matching sync roots.');
    const lines: string[] = [];
    for (const root of selected) {
      lines.push(`root ${root.id.slice(0, 8)} ${root.label || '-'}`);
      for (const row of listFileSyncStatesForRoot(options.store, root.id)) {
        lines.push(`  ${row.path}  ${row.status}`);
      }
    }
    return makeOutput(lines.join('\n'));
  },

  'files-resolve': async (args, options) => {
    if (!hasStore(options)) return makeResultError('files-resolve requires a store');
    if (!options?.session?.isAuthenticated) return makeResultError('Not logged in. Run: solid-login <issuer>');
    if (!options.driver) return makeResultError('files-resolve requires a filesystem driver');
    if (args.length < 2) return makeResultError('Usage: files-resolve <filePath> <keep-local|keep-pod|keep-both>');
    const filePathRaw = args[0]!;
    const resolution = args[1]!;
    if (resolution !== 'keep-local' && resolution !== 'keep-pod' && resolution !== 'keep-both') {
      return makeResultError('Resolution must be keep-local, keep-pod, or keep-both');
    }
    const filePath = assertAbsolutePath(filePathRaw);
    const state = getFileSyncState(options.store, filePath);
    if (!state || state.status !== 'conflict') return makeResultError(`No conflict found for ${filePath}`);
    const root = findSyncRoot(filePath, listSyncRoots(options.store));
    if (!root) return makeResultError(`No sync root found for ${filePath}`);
    await resolveFileConflict(filePath, resolution, root, options.store, options.driver, options.session.fetch);
    return makeOutput(`Resolved conflict for ${filePath} using ${resolution}`);
  }
};
