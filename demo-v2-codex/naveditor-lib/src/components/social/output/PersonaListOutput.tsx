import { Box, Text } from 'ink';
import type { PersonaId, PersonaRow } from '@devalbo/shared';

interface PersonaListOutputProps {
  personas: Array<{ id: PersonaId; row: PersonaRow }>;
  defaultPersona: { id: PersonaId; row: PersonaRow } | null;
}

export const PersonaListOutput: React.FC<PersonaListOutputProps> = ({ personas, defaultPersona }) => {
  if (personas.length === 0) {
    return <Text color="gray">No personas yet. Try: persona create "Alice"</Text>;
  }

  return (
    <Box flexDirection="column">
      {personas.map(({ id, row }) => (
        <Text key={id}>{`${defaultPersona?.id === id ? '★ ' : '• '}${row.name} (${id})`}</Text>
      ))}
    </Box>
  );
};
