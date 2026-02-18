import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { StoreContext, createDevalboStore, logActivity, setContact, setGroup } from '@devalbo/state';
import { ActivityIdToolbox, unsafeAsContactId, unsafeAsGroupId, unsafeAsPersonaId } from '@devalbo/shared';
import { GroupContextPanel } from '@/components/social/d3/GroupContextPanel';

describe('GroupContextPanel', () => {
  it('renders group details and activity log updates', async () => {
    const store = createDevalboStore();
    const groupId = unsafeAsGroupId('group_d3_context');
    setGroup(store, groupId, {
      name: 'Avengers',
      groupType: 'organization',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });

    setContact(store, unsafeAsContactId('contact_d3_a'), {
      name: 'Alice',
      uid: 'urn:uuid:alice',
      kind: 'person',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });

    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <GroupContextPanel groupId={groupId} actorPersonaId={unsafeAsPersonaId('persona_d3')} />
        </StoreContext.Provider>
      );
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Avengers');
    expect(JSON.stringify(renderer.toJSON())).toContain('Nothing shared yet.');

    logActivity(store, ActivityIdToolbox.createRandomId?.() ?? ('activity_d3' as never), {
      actorPersonaId: unsafeAsPersonaId('persona_d3'),
      subjectType: 'group',
      subjectId: groupId,
      activityType: 'share-file',
      payload: JSON.stringify({ filePath: '/tmp/file.txt' }),
      timestamp: '2026-02-18T00:00:00.000Z'
    });

    await act(async () => {
      renderer.update(
        <StoreContext.Provider value={store}>
          <GroupContextPanel groupId={groupId} actorPersonaId={unsafeAsPersonaId('persona_d3')} />
        </StoreContext.Provider>
      );
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('share-file');
  });
});
