import type { Row, Store } from 'tinybase';
import {
  ActivityRowSchema,
  type ActivityId,
  type ActivityRow,
  type ActivityRowInput
} from '@devalbo/shared';
import { ACTIVITIES_TABLE } from '../schemas/social';
import { safeParseWithWarning } from './_validation';

export const logActivity = (store: Store, id: ActivityId, row: ActivityRowInput): void => {
  const parsed = ActivityRowSchema.parse(row);
  store.setRow(ACTIVITIES_TABLE, id, parsed as Row);
};

export const listActivities = (store: Store): Array<{ id: ActivityId; row: ActivityRow }> => {
  const table = store.getTable(ACTIVITIES_TABLE);
  if (!table) return [];

  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = safeParseWithWarning<ActivityRow>(ActivityRowSchema, row, ACTIVITIES_TABLE, id, 'list');
    return parsed ? [{ id: id as ActivityId, row: parsed }] : [];
  });
};

export const listActivitiesForSubject = (
  store: Store,
  subjectType: ActivityRow['subjectType'],
  subjectId: string
): Array<{ id: ActivityId; row: ActivityRow }> =>
  listActivities(store).filter(({ row }) => row.subjectType === subjectType && row.subjectId === subjectId);
