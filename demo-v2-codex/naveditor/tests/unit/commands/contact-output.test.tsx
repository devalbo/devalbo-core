import { beforeEach, describe, expect, it } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import { type ReactElement } from 'react';
import { commands } from '@/commands';
import { ContactDetailOutput } from '@/components/social/output/ContactDetailOutput';
import { ContactListOutput } from '@/components/social/output/ContactListOutput';

describe('contact command output components', () => {
  let store = createDevalboStore();

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('renders contact list output', async () => {
    await commands.contact(['add', 'Bob', '--email', 'bob@example.com'], { store });
    const result = await commands.contact(['list'], { store });
    expect((result.component as ReactElement).type).toBe(ContactListOutput);
    const contacts = (result.component as ReactElement<{ contacts: Array<{ row: { name: string } }> }>).props.contacts;
    expect(contacts[0]?.row.name).toBe('Bob');
  });

  it('renders contact search output heading', async () => {
    await commands.contact(['add', 'Bob'], { store });
    const result = await commands.contact(['search', 'Bob'], { store });
    expect((result.component as ReactElement).type).toBe(ContactListOutput);
    expect((result.component as ReactElement<{ query: string }>).props.query).toBe('Bob');
  });

  it('renders contact detail for show/add/edit', async () => {
    const added = await commands.contact(['add', 'Bob'], { store });
    const id = (added.data as { id: string }).id;

    const show = await commands.contact(['show', id], { store });
    expect((show.component as ReactElement).type).toBe(ContactDetailOutput);
    expect((show.component as ReactElement<{ row: { name: string } }>).props.row.name).toBe('Bob');

    const edit = await commands.contact(['edit', id, '--name=Bob Updated'], { store });
    expect((edit.component as ReactElement).type).toBe(ContactDetailOutput);
    expect((edit.component as ReactElement<{ row: { name: string } }>).props.row.name).toBe('Bob Updated');
  });
});
