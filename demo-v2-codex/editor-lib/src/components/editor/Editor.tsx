import React from 'react';
import { Box, Text } from 'ink';
import { useFileEditor } from '@/hooks/use-file-editor';
import { EditorContent } from './EditorContent';
import { EditorStatusBar } from './EditorStatusBar';
import { Spinner } from '@devalbo/cli-shell/components/ui/spinner';
import { useKeyboard } from '@devalbo/ui';

export const Editor: React.FC<{ filePath: string }> = ({ filePath }) => {
  const { content, isDirty, isLoading, isBinary, fileExists, error, save, revert, createFile } = useFileEditor(filePath);

  useKeyboard((input) => {
    if (input.toLowerCase() === 's') {
      void save();
    }
    if (input.toLowerCase() === 'r') {
      void revert();
    }
    if (!fileExists && input.toLowerCase() === 'c') {
      void createFile();
    }
  });

  if (isLoading) {
    return <Spinner label="Loading file..." />;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (!fileExists) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">File not found: {filePath}</Text>
        <Text dimColor>Press c to create an empty file, or provide another path.</Text>
      </Box>
    );
  }

  if (isBinary) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">Binary file detected</Text>
        <EditorStatusBar filePath={filePath} isDirty={false} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Editor</Text>
      <EditorContent content={content} />
      <EditorStatusBar filePath={filePath} isDirty={isDirty} />
      <Text dimColor>Keys: s save, r reload</Text>
    </Box>
  );
};
