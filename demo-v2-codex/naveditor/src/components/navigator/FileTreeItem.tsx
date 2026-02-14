import React from 'react';
import { Text } from 'ink';
import type { FileEntry } from '@devalbo/shared';

interface Props {
  entry: FileEntry;
  selected: boolean;
}

export const FileTreeItem: React.FC<Props> = ({ entry, selected }) => {
  const icon = entry.isDirectory ? '[D]' : '[F]';
  return (
    <Text color={selected ? 'green' : undefined}>
      {icon} {entry.name}
    </Text>
  );
};
