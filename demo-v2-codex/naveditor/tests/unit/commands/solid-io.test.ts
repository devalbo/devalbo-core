import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDevalboStore, listContacts, listGroups, listMembers, listPersonas } from '@devalbo/state';
import { unsafeAsGroupId } from '@devalbo/shared';
import { commands } from '@/commands';

const must = <T>(value: T | undefined | null): T => {
  if (value == null) throw new Error('Expected value');
  return value;
};

describe('solid import/export commands', () => {
  let store = createDevalboStore();

  beforeEach(() => {
    store = createDevalboStore();
  });

  it('exports and imports a social bundle with memberships', async () => {
    const persona = await commands.persona(['create', 'Alice', '--email', 'alice@example.com'], { store });
    const personaId = must((persona.data as { id?: string })?.id);

    const contact = await commands.contact(['add', 'Bob', '--email', 'bob@example.com'], { store });
    const contactId = must((contact.data as { id?: string })?.id);

    const group = await commands.group(['create', 'Core Team', '--type', 'team'], { store });
    const groupId = must((group.data as { id?: string })?.id);

    await commands.contact(['link', contactId, personaId], { store });
    await commands.group(['add-member', groupId, contactId, '--role', 'http://www.w3.org/ns/org#Role'], { store });

    const outputPath = path.join(os.tmpdir(), `devalbo-solid-${randomUUID()}.json`);
    const exported = await commands['solid-export']([outputPath], { store, cwd: '/' });
    expect(exported.error).toBeUndefined();

    const importedStore = createDevalboStore();
    const imported = await commands['solid-import']([outputPath], { store: importedStore, cwd: '/' });
    expect(imported.error).toBeUndefined();

    expect(listPersonas(importedStore)).toHaveLength(1);
    expect(listContacts(importedStore)).toHaveLength(1);
    expect(listGroups(importedStore)).toHaveLength(1);
    expect(listMembers(importedStore, unsafeAsGroupId(groupId))).toHaveLength(1);
  });
});
