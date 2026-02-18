import React from 'react';
import { Box, Text } from 'ink';
import type { PersonaId, PersonaRow, PersonaRowInput } from '@devalbo/shared';

interface PersonaDetailOutputProps {
  id: PersonaId;
  row: PersonaRow | PersonaRowInput;
}

export const PersonaDetailOutput: React.FC<PersonaDetailOutputProps> = ({ id, row }) => (
  <Box flexDirection="column">
    <Text>{row.name}</Text>
    <Text color="gray">{id}</Text>
    {(row.email ?? '').trim() ? <Text color="gray">{row.email}</Text> : null}
  </Box>
);
