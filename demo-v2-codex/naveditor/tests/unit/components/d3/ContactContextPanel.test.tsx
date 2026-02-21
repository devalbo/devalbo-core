import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { StoreContext, addMember, createDevalboStore, getMembershipRowId, setContact, setGroup } from '@devalbo/state';
import { unsafeAsContactId, unsafeAsGroupId, unsafeAsPersonaId } from '@devalbo/shared';
import { ContactContextPanel } from '@/components/social/d3/ContactContextPanel';

describe('ContactContextPanel', () => {
  it('supports add/remove group memberships for a contact', async () => {
    const store = createDevalboStore();
    const contactId = unsafeAsContactId('contact_d3_manage');
    const groupA = unsafeAsGroupId('group_d3_a');
    const groupB = unsafeAsGroupId('group_d3_b');

    setContact(store, contactId, {
      name: 'Alice',
      uid: 'urn:uuid:alice',
      kind: 'person',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });
    setGroup(store, groupA, {
      name: 'Alpha',
      groupType: 'group',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });
    setGroup(store, groupB, {
      name: 'Beta',
      groupType: 'group',
      updatedAt: '2026-02-18T00:00:00.000Z'
    });
    addMember(store, { groupId: groupA, contactId, role: '', startDate: '', endDate: '' });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ContactContextPanel contactId={contactId} actorPersonaId={unsafeAsPersonaId('persona_d3')} />
        </StoreContext.Provider>
      );
    });

    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Alpha');
    expect(text).toContain('Beta');

    const select = renderer.root.findByType('select');
    const addButton = renderer.root.findAllByType('button').find((button) => button.children.join('').includes('Add'));
    expect(addButton?.props.disabled).toBe(true);

    await act(async () => {
      select.props.onChange({ target: { value: groupB } });
    });
    await act(async () => {
      addButton?.props.onClick();
    });

    expect(store.hasRow('memberships', getMembershipRowId(groupB, contactId))).toBe(true);

    const removeButton = renderer.root.findAllByType('button').find((button) => button.children.join('').includes('Remove'));
    await act(async () => {
      removeButton?.props.onClick();
    });

    expect(store.hasRow('memberships', getMembershipRowId(groupA, contactId))).toBe(false);
  });
});
