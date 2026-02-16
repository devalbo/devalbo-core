import { useCallback, useEffect, useState } from 'react';
import type { FileEntry } from '@devalbo/shared';
import { unsafeAsDirectoryPath, unsafeAsFilePath } from '@devalbo/shared';
import { getDriver, getWatcher } from '../lib/file-operations';

export interface UseFileTreeOptions {
  rootPath: string;
}

export interface UseFileTreeReturn {
  entries: FileEntry[];
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
  select: (path: string) => void;
  refresh: () => Promise<void>;
}

export const useFileTree = ({ rootPath }: UseFileTreeOptions): UseFileTreeReturn => {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const driver = await getDriver();
    setIsLoading(true);
    setError(null);
    try {
      const rows = await driver.readdir(unsafeAsDirectoryPath(rootPath));
      const sorted = [...rows].sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
      setEntries(sorted);
      setSelectedPath((prev) => prev ?? sorted[0]?.path ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    void refresh();

    let unwatch: (() => void) | undefined;
    void (async () => {
      const watcher = await getWatcher();
      unwatch = watcher.watch(unsafeAsDirectoryPath(rootPath), () => {
        void refresh();
      });
    })();

    return () => {
      unwatch?.();
    };
  }, [refresh, rootPath]);

  return {
    entries,
    selectedPath,
    isLoading,
    error,
    select: (path) => setSelectedPath(unsafeAsFilePath(path)),
    refresh
  };
};
