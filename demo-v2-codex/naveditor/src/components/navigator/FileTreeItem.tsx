import React from 'react';
import { Text } from 'ink';
import type { FileEntry } from '@devalbo/shared';

interface Props {
  entry: FileEntry;
  selected: boolean;
}

export const FileTreeItem: React.FC<Props> = ({ entry, selected }) => {
  const fileIcon = (() => {
    if (entry.isDirectory) return '[DIR]';
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return '[TS]';
    if (entry.name.endsWith('.json')) return '[JSON]';
    if (entry.name.endsWith('.md')) return '[MD]';
    return '[FILE]';
  })();
  return (
    <Text {...(selected ? { color: 'green' as const } : {})}>
      {selected ? '>' : ' '} {fileIcon} {entry.name}
    </Text>
  );
};
