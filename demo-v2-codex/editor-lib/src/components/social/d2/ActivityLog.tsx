import type { ActivityId, ActivityRow } from '@devalbo/shared';

interface ActivityLogProps {
  activities: Array<{ id: ActivityId; row: ActivityRow }>;
  emptyMessage?: string;
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }

  return date.toISOString().slice(0, 10);
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ activities, emptyMessage }) => {
  if (activities.length === 0) {
    return <div style={{ color: '#94a3b8' }}>{emptyMessage ?? 'No activity yet.'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {activities
        .slice()
        .sort((a, b) => b.row.timestamp.localeCompare(a.row.timestamp))
        .map(({ id, row }) => (
          <div key={id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '8px', color: '#e2e8f0', fontSize: '13px' }}>
            <span>↑</span>
            <span>{row.activityType}</span>
            <span style={{ color: '#94a3b8' }}>{formatTimestamp(row.timestamp)}</span>
          </div>
        ))}
    </div>
  );
};
