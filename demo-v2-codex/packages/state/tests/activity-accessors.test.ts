import { describe, expect, it } from 'vitest';
import { ActivityIdToolbox, unsafeAsPersonaId } from '@devalbo/shared';
import { createDevalboStore } from '../src/store';
import { listActivities, listActivitiesForSubject, logActivity } from '../src/accessors/activities';

describe('activity accessors', () => {
  it('logActivity stores row and listActivities returns it', () => {
    const store = createDevalboStore();
    const id = ActivityIdToolbox.createRandomId?.() ?? 'activity_test_1';

    logActivity(store, id, {
      actorPersonaId: unsafeAsPersonaId('persona_1'),
      subjectType: 'contact',
      subjectId: 'contact_1',
      activityType: 'share-card',
      payload: JSON.stringify({ hello: 'world' }),
      timestamp: '2026-02-18T00:00:00.000Z'
    });

    expect(listActivities(store)).toHaveLength(1);
    expect(listActivities(store)[0]?.id).toBe(id);
  });

  it('listActivitiesForSubject filters by subjectType + subjectId', () => {
    const store = createDevalboStore();
    const idA = ActivityIdToolbox.createRandomId?.() ?? 'activity_test_a';
    const idB = ActivityIdToolbox.createRandomId?.() ?? 'activity_test_b';

    logActivity(store, idA, {
      actorPersonaId: unsafeAsPersonaId('persona_1'),
      subjectType: 'contact',
      subjectId: 'contact_a',
      activityType: 'share-file',
      payload: JSON.stringify({ filePath: '/a' }),
      timestamp: '2026-02-18T00:00:00.000Z'
    });

    logActivity(store, idB, {
      actorPersonaId: unsafeAsPersonaId('persona_1'),
      subjectType: 'group',
      subjectId: 'group_a',
      activityType: 'invite',
      payload: JSON.stringify({ text: 'hi' }),
      timestamp: '2026-02-18T00:00:00.000Z'
    });

    expect(listActivitiesForSubject(store, 'contact', 'contact_a')).toHaveLength(1);
    expect(listActivitiesForSubject(store, 'group', 'group_a')).toHaveLength(1);
    expect(listActivitiesForSubject(store, 'group', 'missing')).toHaveLength(0);
  });
});
