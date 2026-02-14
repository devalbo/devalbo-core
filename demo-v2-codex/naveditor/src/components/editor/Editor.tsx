import React from 'react';
import { Box, Text } from 'ink';
import { useFileEditor } from '@/hooks/use-file-editor';
import { EditorContent } from './EditorContent';
import { EditorStatusBar } from './EditorStatusBar';

export const Editor: React.FC<{ filePath: string }> = ({ filePath }) => {
  const { content, isDirty, isLoading, error } = useFileEditor(filePath);

  if (isLoading) {
    return <Text>Loading file...</Text>;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Editor</Text>
      <EditorContent content={content} />
      <EditorStatusBar filePath={filePath} isDirty={isDirty} />
    </Box>
  );
};
