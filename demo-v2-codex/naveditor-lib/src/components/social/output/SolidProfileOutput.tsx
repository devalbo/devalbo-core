import { Box, Text } from 'ink';
import type { PersonaId, PersonaRow, PersonaRowInput } from '@devalbo/shared';

interface SolidProfileOutputProps {
  id: PersonaId;
  row: PersonaRow | PersonaRowInput;
}

export const SolidProfileOutput: React.FC<SolidProfileOutputProps> = ({ id, row }) => (
  <Box flexDirection="column">
    <Text>{row.name}</Text>
    <Text color="gray">{id}</Text>
    {(row.email ?? '').trim() ? <Text color="gray">{row.email}</Text> : null}
    {(row.oidcIssuer ?? '').trim() ? <Text color="gray">OIDC: {row.oidcIssuer}</Text> : null}
    {(row.inbox ?? '').trim() ? <Text color="gray">Inbox: {row.inbox}</Text> : null}
  </Box>
);
