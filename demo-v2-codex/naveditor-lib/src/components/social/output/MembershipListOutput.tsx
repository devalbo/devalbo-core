import { Box, Text } from 'ink';
import type { GroupId, MembershipId, MembershipRow } from '@devalbo/shared';

interface MembershipListOutputProps {
  members: Array<{ id: MembershipId; row: MembershipRow }>;
  groupId: GroupId;
}

export const MembershipListOutput: React.FC<MembershipListOutputProps> = ({ members, groupId }) => {
  if (members.length === 0) {
    return <Text color="gray">No members for this group.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text>{`Members of ${groupId}`}</Text>
      {members.map(({ id, row }) => (
        <Text key={id}>{`• ${row.contactId}${row.role.trim() ? ` (${row.role.trim()})` : ''}`}</Text>
      ))}
    </Box>
  );
};
