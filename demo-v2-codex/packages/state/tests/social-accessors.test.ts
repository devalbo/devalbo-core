import { describe, expect, it, vi } from 'vitest';
import { createDevalboStore } from '../src/store';
import {
  addMember,
  deleteContact,
  deleteGroup,
  deletePersona,
  getContact,
  getDefaultPersona,
  getGroup,
  getGroupsForContact,
  getPersona,
  linkContactToPersona,
  listContacts,
  listGroups,
  listMembers,
  listPersonas,
  removeMember,
  searchContacts,
  setContact,
  setDefaultPersona,
  setGroup,
  setPersona
} from '../src/accessors';
import {
  CONTACTS_TABLE,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PERSONA_ID_VALUE,
  GROUPS_TABLE,
  MEMBERSHIPS_TABLE,
  PERSONAS_TABLE,
  SCHEMA_VERSION_VALUE
} from '../src/schemas/social';

describe('social accessors', () => {
  it('creates store with social schema and version value', () => {
    const store = createDevalboStore();

    expect(store.hasTable(PERSONAS_TABLE)).toBe(false);
    expect(store.hasTable(CONTACTS_TABLE)).toBe(false);
    expect(store.hasTable(GROUPS_TABLE)).toBe(false);
    expect(store.hasTable(MEMBERSHIPS_TABLE)).toBe(false);
    expect(store.getValue(SCHEMA_VERSION_VALUE)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('persona CRUD and default selection', () => {
    const store = createDevalboStore();

    setPersona(store, 'persona-a', {
      name: 'Alice',
      email: 'mailto:alice@example.com',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setPersona(store, 'persona-b', {
      name: 'Bob',
      isDefault: true,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getPersona(store, 'persona-a')?.name).toBe('Alice');
    expect(listPersonas(store)).toHaveLength(2);
    expect(getDefaultPersona(store)?.id).toBe('persona-b');

    setDefaultPersona(store, 'persona-a');
    expect(getDefaultPersona(store)?.id).toBe('persona-a');

    deletePersona(store, 'persona-a');
    expect(getPersona(store, 'persona-a')).toBeNull();
    expect(store.getValue(DEFAULT_PERSONA_ID_VALUE)).toBe('');
  });

  it('setPersona with isDefault true keeps only one default persona', () => {
    const store = createDevalboStore();

    setPersona(store, 'persona-a', {
      name: 'Alice',
      isDefault: true,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    setPersona(store, 'persona-b', {
      name: 'Bob',
      isDefault: true,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getDefaultPersona(store)?.id).toBe('persona-b');
    expect(getPersona(store, 'persona-a')?.isDefault).toBe(false);
    expect(getPersona(store, 'persona-b')?.isDefault).toBe(true);
  });

  it('contact CRUD/search/link', () => {
    const store = createDevalboStore();

    setPersona(store, 'persona-1', {
      name: 'Primary',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    setContact(store, 'contact-1', {
      name: 'Acme Bot',
      uid: 'urn:uuid:1',
      kind: 'agent',
      organization: 'Acme',
      notes: 'automation',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    setContact(store, 'contact-2', {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      email: 'mailto:jane@example.com',
      webId: 'https://pod.example.com/profile/card#me',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getContact(store, 'contact-1')?.name).toBe('Acme Bot');
    expect(listContacts(store)).toHaveLength(2);
    expect(searchContacts(store, 'acme')).toHaveLength(1);
    expect(searchContacts(store, 'http')).toHaveLength(0);

    linkContactToPersona(store, 'contact-2', 'persona-1');
    expect(getContact(store, 'contact-2')?.linkedPersona).toBe('persona-1');

    deleteContact(store, 'contact-1');
    expect(getContact(store, 'contact-1')).toBeNull();
  });

  it('group CRUD', () => {
    const store = createDevalboStore();

    setGroup(store, 'group-1', {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getGroup(store, 'group-1')?.name).toBe('Core Team');
    expect(listGroups(store)).toHaveLength(1);

    deleteGroup(store, 'group-1');
    expect(getGroup(store, 'group-1')).toBeNull();
  });

  it('membership lifecycle and reverse lookup', () => {
    const store = createDevalboStore();

    setGroup(store, 'group-1', {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setGroup(store, 'group-2', {
      name: 'Org',
      groupType: 'organization',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, 'contact-1', {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    addMember(store, {
      groupId: 'group-1',
      contactId: 'contact-1',
      role: 'http://www.w3.org/ns/org#Role',
      startDate: '2026-02-16T00:00:00.000Z'
    });

    addMember(store, {
      groupId: 'group-2',
      contactId: 'contact-1'
    });

    expect(listMembers(store, 'group-1')).toHaveLength(1);
    expect(getGroupsForContact(store, 'contact-1')).toEqual(['group-1', 'group-2']);

    removeMember(store, 'group-1', 'contact-1');
    expect(listMembers(store, 'group-1')).toHaveLength(0);
  });

  it('deleteContact and deleteGroup cascade memberships', () => {
    const store = createDevalboStore();

    setGroup(store, 'group-1', {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setGroup(store, 'group-2', {
      name: 'Org',
      groupType: 'organization',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, 'contact-1', {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, 'contact-2', {
      name: 'Jon User',
      uid: 'urn:uuid:3',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    addMember(store, { groupId: 'group-1', contactId: 'contact-1' });
    addMember(store, { groupId: 'group-1', contactId: 'contact-2' });
    addMember(store, { groupId: 'group-2', contactId: 'contact-1' });

    deleteContact(store, 'contact-1');
    expect(listMembers(store, 'group-1').map(({ row }) => row.contactId)).toEqual(['contact-2']);
    expect(listMembers(store, 'group-2')).toEqual([]);

    deleteGroup(store, 'group-1');
    expect(listMembers(store, 'group-1')).toEqual([]);
  });

  it('rejects invalid persona/contact/group rows', () => {
    const store = createDevalboStore();

    expect(() => setPersona(store, 'bad-persona', {
      name: '',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    })).toThrow();

    expect(() => setContact(store, 'bad-contact', {
      name: 'Bad',
      uid: 'urn:uuid:3',
      kind: 'robot' as 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    })).toThrow();

    expect(() => setGroup(store, 'bad-group', {
      name: 'Bad Group',
      groupType: 'squad' as 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    })).toThrow();
  });

  it('rejects membership when group or contact does not exist', () => {
    const store = createDevalboStore();

    setGroup(store, 'group-1', {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(() => addMember(store, {
      groupId: 'group-1',
      contactId: 'missing-contact'
    })).toThrow('Contact not found');

    setContact(store, 'contact-1', {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(() => addMember(store, {
      groupId: 'missing-group',
      contactId: 'contact-1'
    })).toThrow('Group not found');
  });

  it('handles stores with no social rows (migration safety)', () => {
    const store = createDevalboStore();

    store.setTables({
      entries: {
        'entry-1': {
          path: '/README.md',
          name: 'README.md',
          parentPath: '/',
          isDirectory: false,
          size: 1,
          mtime: '2026-02-16T00:00:00.000Z'
        }
      },
      buffers: {
        'buffer-1': {
          path: '/README.md',
          content: 'hello',
          isDirty: false,
          cursorLine: 1,
          cursorCol: 1
        }
      }
    });

    expect(listPersonas(store)).toEqual([]);
    expect(listContacts(store)).toEqual([]);
    expect(listGroups(store)).toEqual([]);
    expect(listMembers(store, 'group-1')).toEqual([]);
    expect(getDefaultPersona(store)).toBeNull();
  });

  it('warns when malformed rows exist but fail accessor validation', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createDevalboStore();

    store.setRow(PERSONAS_TABLE, 'bad-persona', {
      name: '',
      nickname: '',
      givenName: '',
      familyName: '',
      email: '',
      phone: '',
      image: '',
      bio: '',
      homepage: '',
      oidcIssuer: '',
      inbox: '',
      publicTypeIndex: '',
      privateTypeIndex: '',
      preferencesFile: '',
      profileDoc: '',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getPersona(store, 'bad-persona')).toBeNull();
    expect(listPersonas(store)).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
