import { Box, Text } from 'ink';
import type { ContactId, ContactRow } from '@devalbo/shared';

interface ContactListOutputProps {
  contacts: Array<{ id: ContactId; row: ContactRow }>;
  query?: string;
}

export const ContactListOutput: React.FC<ContactListOutputProps> = ({ contacts, query }) => {
  if (contacts.length === 0) {
    return <Text color="gray">No contacts yet. Try: contact add "Bob"</Text>;
  }

  return (
    <Box flexDirection="column">
      {query ? <Text>{`Results for "${query}"`}</Text> : null}
      {contacts.map(({ id, row }) => (
        <Text key={id}>{`• ${row.name} [${row.kind}] (${id})`}</Text>
      ))}
    </Box>
  );
};
