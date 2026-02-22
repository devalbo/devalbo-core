import React from 'react';
import { Box, Text } from 'ink';
import { Editor } from '@/components/editor/Editor';
import { withValidation } from '@devalbo/cli-shell/commands/with-validation';
import { validateEditArgs } from '@devalbo/cli-shell/lib/validate-args';

export const editCommand = (args: string[]) =>
  withValidation(
    validateEditArgs(args),
    ({ file }) => <Editor filePath={file} />,
    (error) => (
      <Box flexDirection="column" padding={1}>
        <Text color="red">{error.message}</Text>
      </Box>
    )
  );
