import type { AbsolutePath, PodUrl, RelativePath, SyncRoot } from '@devalbo/shared';
import { unsafeAsPodUrl, unsafeAsRelativePath } from '@devalbo/shared';

export const findSyncRoot = (localPath: AbsolutePath, roots: SyncRoot[]): SyncRoot | null => {
  // AbsolutePath is enforced to start with '/', so no normalization needed.
  // root.localPath ends with '/' (DirectoryPath invariant), making the startsWith check segment-safe.
  return roots
    .filter((root) => root.enabled && root.localPath.endsWith('/') && localPath.startsWith(root.localPath))
    .sort((a, b) => b.localPath.length - a.localPath.length)[0] ?? null;
};

export const toRelativePath = (localPath: AbsolutePath, root: SyncRoot): RelativePath => {
  const relativePath = localPath.slice(root.localPath.length);
  return unsafeAsRelativePath(relativePath);
};

export const localPathToPodUrl = (localPath: AbsolutePath, root: SyncRoot): PodUrl => {
  const relativePath = toRelativePath(localPath, root);
  const encoded = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const suffix = localPath.endsWith('/') && encoded !== '' ? `${encoded}/` : encoded;
  return unsafeAsPodUrl(`${root.podUrl}${suffix}`);
};

export const podUrlToLocalPath = (podUrl: PodUrl, root: SyncRoot): AbsolutePath | null => {
  if (!podUrl.startsWith(root.podUrl)) return null;
  const suffix = podUrl.slice(root.podUrl.length);
  const decoded = suffix
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join('/');
  const localPath = decoded === '' ? root.localPath : `${root.localPath}${decoded}${podUrl.endsWith('/') ? '/' : ''}`;
  return localPath as AbsolutePath;
};

export const findRootConflicts = (roots: SyncRoot[]): Array<[SyncRoot, SyncRoot]> => {
  const conflicts: Array<[SyncRoot, SyncRoot]> = [];
  for (let i = 0; i < roots.length; i += 1) {
    const a = roots[i];
    if (!a) continue;
    for (let j = i + 1; j < roots.length; j += 1) {
      const b = roots[j];
      if (!b) continue;
      if (a.localPath.startsWith(b.localPath) || b.localPath.startsWith(a.localPath)) {
        conflicts.push([a, b]);
      }
    }
  }
  return conflicts;
};
