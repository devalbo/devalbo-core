import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  path: string;
  fileCount: number;
}

export const NavigatorStatusBar: React.FC<Props> = ({ path, fileCount }) => (
  <Box borderStyle="single" paddingX={1}>
    <Text dimColor>
      {path} | entries: {fileCount}
    </Text>
  </Box>
);
