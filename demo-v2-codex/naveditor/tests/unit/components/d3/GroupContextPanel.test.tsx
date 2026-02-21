import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { StoreContext, addMember, createDevalboStore, getMembershipRowId, listMembers, logActivity, setContact, setGroup } from '@devalbo/state';
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

  it('supports add/remove member controls', async () => {
    const store = createDevalboStore();
    const groupId = unsafeAsGroupId('group_d3_manage');
    const contactA = unsafeAsContactId('contact_d3_a');
    const contactB = unsafeAsContactId('contact_d3_b');

    setGroup(store, groupId, {
      name: 'Avengers',
      groupType: 'organization',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });

    setContact(store, contactA, {
      name: 'Alice',
      uid: 'urn:uuid:alice',
      kind: 'person',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });
    setContact(store, contactB, {
      name: 'Bob',
      uid: 'urn:uuid:bob',
      kind: 'person',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });

    addMember(store, { groupId, contactId: contactA, role: '', startDate: '', endDate: '' });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <GroupContextPanel groupId={groupId} actorPersonaId={unsafeAsPersonaId('persona_d3')} />
        </StoreContext.Provider>
      );
    });

    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');

    const select = renderer.root.findByType('select');
    const addButton = renderer.root.findAllByType('button').find((button) => button.children.join('').includes('Add'));
    expect(addButton?.props.disabled).toBe(true);

    await act(async () => {
      select.props.onChange({ target: { value: contactB } });
    });
    await act(async () => {
      addButton?.props.onClick();
    });

    expect(listMembers(store, groupId).map((entry) => entry.row.contactId)).toEqual(expect.arrayContaining([contactA, contactB]));

    const removeAliceButton = renderer.root.findAllByType('button').find((button) => button.children.join('').includes('Remove'));
    await act(async () => {
      removeAliceButton?.props.onClick();
    });

    expect(store.hasRow('memberships', getMembershipRowId(groupId, contactA))).toBe(false);
  });
});
