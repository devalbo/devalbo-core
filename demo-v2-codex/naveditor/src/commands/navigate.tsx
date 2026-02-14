import React from 'react';
import { Navigator } from '@/components/navigator/Navigator';
import { withValidation } from './with-validation';
import { validateNavigateArgs } from '@/lib/validate-args';
import { Box, Text } from 'ink';

export const navigateCommand = (args: string[]) =>
  withValidation(
    validateNavigateArgs(args),
    ({ path }) => <Navigator rootPath={path} />,
    (error) => (
      <Box flexDirection="column" padding={1}>
        <Text color="red">{error.message}</Text>
      </Box>
    )
  );
