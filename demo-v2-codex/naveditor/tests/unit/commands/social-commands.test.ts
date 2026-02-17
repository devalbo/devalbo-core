import { beforeEach, describe, expect, it } from 'vitest';
import { createDevalboStore } from '@devalbo/state';
import { commands } from '@/commands';

const must = <T>(value: T | undefined | null): T => {
  if (value == null) throw new Error('Expected value');
  return value;
};

describe('social commands', () => {
  let store = createDevalboStore();

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('supports persona lifecycle', async () => {
    const create = await commands.persona(['create', 'Alice'], { store });
    expect(create.status).toBe('ok');

    const id = must((create.data as { id?: string }).id);
    expect(id.startsWith('persona_')).toBe(true);

    const list = await commands.persona(['list'], { store });
    expect(list.status).toBe('ok');
    expect(((list.data as { personas: Array<{ id: string }> }).personas).length).toBe(1);

    const show = await commands.persona(['show', id], { store });
    expect(show.status).toBe('ok');

    const setDefault = await commands.persona(['set-default', id], { store });
    expect(setDefault.status).toBe('ok');

    const del = await commands.persona(['delete', id], { store });
    expect(del.status).toBe('ok');
  });

  it('supports contact commands and linking', async () => {
    const persona = await commands.persona(['create', 'Alice'], { store });
    const personaId = must((persona.data as { id?: string }).id);

    const add = await commands.contact(['add', 'Bob', '--email', 'bob@example.com'], { store });
    expect(add.status).toBe('ok');
    const contactId = must((add.data as { id?: string }).id);

    const link = await commands.contact(['link', contactId, personaId], { store });
    expect(link.status).toBe('ok');

    const search = await commands.contact(['search', 'Bob'], { store });
    expect(search.status).toBe('ok');
    expect(((search.data as { contacts: Array<{ id: string }> }).contacts).length).toBe(1);

    const del = await commands.contact(['delete', contactId], { store });
    expect(del.status).toBe('ok');
  });

  it('supports group and membership commands', async () => {
    const contact = await commands.contact(['add', 'Bob'], { store });
    const contactId = must((contact.data as { id?: string }).id);

    const group = await commands.group(['create', 'Core', '--type', 'team'], { store });
    expect(group.status).toBe('ok');
    const groupId = must((group.data as { id?: string }).id);

    const addMember = await commands.group(['add-member', groupId, contactId, '--role', 'member'], { store });
    expect(addMember.status).toBe('ok');

    const members = await commands.group(['list-members', groupId], { store });
    expect(members.status).toBe('ok');
    expect(((members.data as { members: Array<{ id: string }> }).members).length).toBe(1);

    const removeMember = await commands.group(['remove-member', groupId, contactId], { store });
    expect(removeMember.status).toBe('ok');

    const del = await commands.group(['delete', groupId], { store });
    expect(del.status).toBe('ok');
  });

  it('returns subcommand help for bare namespace command', async () => {
    const result = await commands.contact([], { store });
    expect(result.status).toBe('ok');
    expect((result.data as { subcommands: string[] }).subcommands.length).toBeGreaterThan(0);
  });
});
