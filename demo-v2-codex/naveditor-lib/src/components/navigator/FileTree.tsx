import React from 'react';
import { Box, Text } from 'ink';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '@devalbo/shared';
import { useKeyboard } from '@devalbo/ui';
import { Spinner } from '@/components/ui/spinner';

export const FileTree: React.FC<{
  entries: FileEntry[];
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (path: string) => void;
}> = ({ entries, selectedPath, isLoading, error, onSelect }) => {
  useKeyboard((_input, key) => {
    if (entries.length === 0) return;
    const currentIndex = Math.max(0, entries.findIndex((entry) => entry.path === selectedPath));
    if (key.upArrow) {
      const nextIndex = Math.max(0, currentIndex - 1);
      const next = entries[nextIndex];
      if (next) onSelect(next.path);
    }
    if (key.downArrow) {
      const nextIndex = Math.min(entries.length - 1, currentIndex + 1);
      const next = entries[nextIndex];
      if (next) onSelect(next.path);
    }
  });

  if (isLoading) {
    return <Spinner label="Loading files..." />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (entries.length === 0) {
    return <Text dimColor>Directory is empty.</Text>;
  }

  return (
    <Box flexDirection="column">
      {entries.map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} selected={selectedPath === entry.path} />
      ))}
    </Box>
  );
};
