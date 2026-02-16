import React from 'react';
import { Box, Text } from 'ink';
import { useFileTreeStore } from '@/hooks/use-file-tree-store';
import { FileTree } from './FileTree';
import { NavigatorStatusBar } from './NavigatorStatusBar';
import { FILE_TREE_TABLE } from '@devalbo/state';
import { Spinner } from '@/components/ui/spinner';
import { unsafeAsFilePath, type FileEntry } from '@devalbo/shared';

export const Navigator: React.FC<{ rootPath: string }> = ({ rootPath }) => {
  const { store, tree } = useFileTreeStore(rootPath);
  const rows = Object.values(store.getTable(FILE_TREE_TABLE));
  const entries: FileEntry[] = rows.map((row) => {
    const mtimeRaw = row.mtime ? String(row.mtime) : '';
    return {
      name: String(row.name ?? ''),
      path: unsafeAsFilePath(String(row.path ?? '')),
      isDirectory: Boolean(row.isDirectory),
      size: Number(row.size ?? 0),
      ...(mtimeRaw ? { mtime: new Date(mtimeRaw) } : {})
    };
  });

  if (tree.isLoading) {
    return <Spinner label="Loading files..." />;
  }

  if (tree.error) {
    return <Text color="red">{tree.error}</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Navigator</Text>
      <FileTree
        entries={entries}
        selectedPath={tree.selectedPath}
        isLoading={tree.isLoading}
        error={tree.error}
        onSelect={tree.select}
      />
      <NavigatorStatusBar path={rootPath} fileCount={entries.length} />
    </Box>
  );
};
