import { Box, Text } from 'ink';
import type { GroupId, GroupRow, GroupRowInput } from '@devalbo/shared';

interface GroupDetailOutputProps {
  id: GroupId;
  row: GroupRow | GroupRowInput;
}

export const GroupDetailOutput: React.FC<GroupDetailOutputProps> = ({ id, row }) => (
  <Box flexDirection="column">
    <Text>{`${row.name} [${row.groupType}]`}</Text>
    <Text color="gray">{id}</Text>
    {(row.url ?? '').trim() ? <Text color="gray">{row.url}</Text> : null}
  </Box>
);
