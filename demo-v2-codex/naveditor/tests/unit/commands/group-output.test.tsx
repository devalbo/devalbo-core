import { beforeEach, describe, expect, it } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import { type ReactElement } from 'react';
import { commands } from '@/commands';
import { GroupDetailOutput } from '@/components/social/output/GroupDetailOutput';
import { GroupListOutput } from '@/components/social/output/GroupListOutput';
import { MembershipListOutput } from '@/components/social/output/MembershipListOutput';

describe('group command output components', () => {
  let store = createDevalboStore();

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('renders group list output', async () => {
    await commands.group(['create', 'Core Team', '--type', 'team'], { store });
    const result = await commands.group(['list'], { store });
    expect((result.component as ReactElement).type).toBe(GroupListOutput);
    const groups = (result.component as ReactElement<{ groups: Array<{ row: { name: string } }> }>).props.groups;
    expect(groups[0]?.row.name).toBe('Core Team');
  });

  it('renders group detail for show/create/edit', async () => {
    const created = await commands.group(['create', 'Core Team'], { store });
    const id = (created.data as { id: string }).id;

    const show = await commands.group(['show', id], { store });
    expect((show.component as ReactElement).type).toBe(GroupDetailOutput);
    expect((show.component as ReactElement<{ row: { name: string } }>).props.row.name).toBe('Core Team');

    const edit = await commands.group(['edit', id, '--name=New Name'], { store });
    expect((edit.component as ReactElement).type).toBe(GroupDetailOutput);
    expect((edit.component as ReactElement<{ row: { name: string } }>).props.row.name).toBe('New Name');
  });

  it('renders members list output', async () => {
    const contact = await commands.contact(['add', 'Bob'], { store });
    const contactId = (contact.data as { id: string }).id;
    const group = await commands.group(['create', 'Core Team'], { store });
    const groupId = (group.data as { id: string }).id;
    await commands.group(['add-member', groupId, contactId], { store });

    const result = await commands.group(['list-members', groupId], { store });
    expect((result.component as ReactElement).type).toBe(MembershipListOutput);
    const members = (result.component as ReactElement<{ members: Array<{ row: { contactId: string } }> }>).props.members;
    expect(members[0]?.row.contactId).toBe(contactId);
  });
});
