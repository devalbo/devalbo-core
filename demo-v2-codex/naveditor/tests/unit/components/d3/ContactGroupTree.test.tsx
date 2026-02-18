import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { unsafeAsContactId, unsafeAsGroupId, unsafeAsMembershipId } from '@devalbo/shared';
import { ContactGroupTree } from '@/components/social/d3/ContactGroupTree';

describe('ContactGroupTree', () => {
  it('shows grouped and ungrouped contacts and handles clicks', async () => {
    const onSelectGroupCalls: string[] = [];
    const onSelectContactCalls: string[] = [];
    let renderer!: ReactTestRenderer;

    const groups = [
      { id: unsafeAsGroupId('group_a'), row: { name: 'Avengers', groupType: 'organization', description: '', url: '', logo: '', parentGroup: '', updatedAt: '2026-02-18T00:00:00.000Z' } },
      { id: unsafeAsGroupId('group_b'), row: { name: 'Staff', groupType: 'team', description: '', url: '', logo: '', parentGroup: '', updatedAt: '2026-02-18T00:00:00.000Z' } }
    ];

    const contacts = [
      { id: unsafeAsContactId('contact_a'), row: { name: 'Alice', uid: 'urn:uuid:a', nickname: '', kind: 'person', email: '', phone: '', url: '', photo: '', notes: '', organization: '', role: '', webId: '', agentCategory: '', linkedPersona: '', updatedAt: '2026-02-18T00:00:00.000Z' } },
      { id: unsafeAsContactId('contact_b'), row: { name: 'Bob', uid: 'urn:uuid:b', nickname: '', kind: 'person', email: '', phone: '', url: '', photo: '', notes: '', organization: '', role: '', webId: '', agentCategory: '', linkedPersona: '', updatedAt: '2026-02-18T00:00:00.000Z' } },
      { id: unsafeAsContactId('contact_c'), row: { name: 'Carol', uid: 'urn:uuid:c', nickname: '', kind: 'person', email: '', phone: '', url: '', photo: '', notes: '', organization: '', role: '', webId: '', agentCategory: '', linkedPersona: '', updatedAt: '2026-02-18T00:00:00.000Z' } }
    ];

    const memberships = [
      { id: unsafeAsMembershipId('m_a'), row: { groupId: unsafeAsGroupId('group_a'), contactId: unsafeAsContactId('contact_a'), role: '', startDate: '', endDate: '' } },
      { id: unsafeAsMembershipId('m_b'), row: { groupId: unsafeAsGroupId('group_b'), contactId: unsafeAsContactId('contact_a'), role: '', startDate: '', endDate: '' } },
      { id: unsafeAsMembershipId('m_c'), row: { groupId: unsafeAsGroupId('group_a'), contactId: unsafeAsContactId('contact_b'), role: '', startDate: '', endDate: '' } }
    ];

    await act(async () => {
      renderer = create(
        <ContactGroupTree
          groups={groups}
          contacts={contacts}
          memberships={memberships}
          selectedId={null}
          selectedType={null}
          onSelectGroup={(id) => onSelectGroupCalls.push(id)}
          onSelectContact={(id) => onSelectContactCalls.push(id)}
        />
      );
    });

    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Alice');
    expect(text).toContain('Carol');
    expect(text).toContain('Ungrouped');

    const buttons = renderer.root.findAllByType('button');
    const avengers = buttons.find((button) => button.children.join('').includes('Avengers'));
    const alice = buttons.find((button) => button.children.join('').includes('Alice'));

    await act(async () => {
      avengers?.props.onClick();
      alice?.props.onClick();
    });

    expect(onSelectGroupCalls.length).toBeGreaterThan(0);
    expect(onSelectContactCalls.length).toBeGreaterThan(0);
  });
});
