import React from 'react';
import { Box, Text } from 'ink';
import type { GroupId, GroupRow } from '@devalbo/shared';

interface GroupListOutputProps {
  groups: Array<{ id: GroupId; row: GroupRow }>;
}

export const GroupListOutput: React.FC<GroupListOutputProps> = ({ groups }) => {
  if (groups.length === 0) {
    return <Text color="gray">No groups yet. Try: group create "Avengers" --type organization</Text>;
  }

  return (
    <Box flexDirection="column">
      {groups.map(({ id, row }) => (
        <Text key={id}>{`• ${row.name} [${row.groupType}] (${id})`}</Text>
      ))}
    </Box>
  );
};
