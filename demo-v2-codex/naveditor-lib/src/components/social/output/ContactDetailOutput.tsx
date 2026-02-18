import React from 'react';
import { Box, Text } from 'ink';
import type { ContactId, ContactRow, ContactRowInput } from '@devalbo/shared';

interface ContactDetailOutputProps {
  id: ContactId;
  row: ContactRow | ContactRowInput;
}

export const ContactDetailOutput: React.FC<ContactDetailOutputProps> = ({ id, row }) => (
  <Box flexDirection="column">
    <Text>{`${row.name} [${row.kind}]`}</Text>
    <Text color="gray">{id}</Text>
    {(row.email ?? '').trim() ? <Text color="gray">{row.email}</Text> : null}
  </Box>
);
