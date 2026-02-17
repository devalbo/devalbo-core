import { describe, expect, it, vi } from 'vitest';
import {
  unsafeAsContactId,
  unsafeAsGroupId,
  unsafeAsPersonaId
} from '@devalbo/shared';
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

const PERSONA_A = unsafeAsPersonaId('persona-a');
const PERSONA_B = unsafeAsPersonaId('persona-b');
const PERSONA_1 = unsafeAsPersonaId('persona-1');
const BAD_PERSONA = unsafeAsPersonaId('bad-persona');

const CONTACT_1 = unsafeAsContactId('contact-1');
const CONTACT_2 = unsafeAsContactId('contact-2');
const MISSING_CONTACT = unsafeAsContactId('missing-contact');
const BAD_CONTACT = unsafeAsContactId('bad-contact');

const GROUP_1 = unsafeAsGroupId('group-1');
const GROUP_2 = unsafeAsGroupId('group-2');
const MISSING_GROUP = unsafeAsGroupId('missing-group');
const BAD_GROUP = unsafeAsGroupId('bad-group');

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

    setPersona(store, PERSONA_A, {
      name: 'Alice',
      email: 'mailto:alice@example.com',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setPersona(store, PERSONA_B, {
      name: 'Bob',
      isDefault: true,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getPersona(store, PERSONA_A)?.name).toBe('Alice');
    expect(listPersonas(store)).toHaveLength(2);
    expect(getDefaultPersona(store)?.id).toBe(PERSONA_B);

    setDefaultPersona(store, PERSONA_A);
    expect(getDefaultPersona(store)?.id).toBe(PERSONA_A);

    deletePersona(store, PERSONA_A);
    expect(getPersona(store, PERSONA_A)).toBeNull();
    expect(store.getValue(DEFAULT_PERSONA_ID_VALUE)).toBe('');
  });

  it('setPersona with isDefault true keeps only one default persona', () => {
    const store = createDevalboStore();

    setPersona(store, PERSONA_A, {
      name: 'Alice',
      isDefault: true,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    setPersona(store, PERSONA_B, {
      name: 'Bob',
      isDefault: true,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getDefaultPersona(store)?.id).toBe(PERSONA_B);
    expect(getPersona(store, PERSONA_A)?.isDefault).toBe(false);
    expect(getPersona(store, PERSONA_B)?.isDefault).toBe(true);
  });

  it('contact CRUD/search/link', () => {
    const store = createDevalboStore();

    setPersona(store, PERSONA_1, {
      name: 'Primary',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    setContact(store, CONTACT_1, {
      name: 'Acme Bot',
      uid: 'urn:uuid:1',
      kind: 'agent',
      organization: 'Acme',
      notes: 'automation',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    setContact(store, CONTACT_2, {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      email: 'mailto:jane@example.com',
      webId: 'https://pod.example.com/profile/card#me',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getContact(store, CONTACT_1)?.name).toBe('Acme Bot');
    expect(listContacts(store)).toHaveLength(2);
    expect(searchContacts(store, 'acme')).toHaveLength(1);
    expect(searchContacts(store, 'http')).toHaveLength(0);

    linkContactToPersona(store, CONTACT_2, PERSONA_1);
    expect(getContact(store, CONTACT_2)?.linkedPersona).toBe('persona-1');

    deleteContact(store, CONTACT_1);
    expect(getContact(store, CONTACT_1)).toBeNull();
  });

  it('group CRUD', () => {
    const store = createDevalboStore();

    setGroup(store, GROUP_1, {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(getGroup(store, GROUP_1)?.name).toBe('Core Team');
    expect(listGroups(store)).toHaveLength(1);

    deleteGroup(store, GROUP_1);
    expect(getGroup(store, GROUP_1)).toBeNull();
  });

  it('membership lifecycle and reverse lookup', () => {
    const store = createDevalboStore();

    setGroup(store, GROUP_1, {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setGroup(store, GROUP_2, {
      name: 'Org',
      groupType: 'organization',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, CONTACT_1, {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    addMember(store, {
      groupId: GROUP_1,
      contactId: CONTACT_1,
      role: 'http://www.w3.org/ns/org#Role',
      startDate: '2026-02-16T00:00:00.000Z'
    });

    addMember(store, {
      groupId: GROUP_2,
      contactId: CONTACT_1
    });

    expect(listMembers(store, GROUP_1)).toHaveLength(1);
    expect(getGroupsForContact(store, CONTACT_1)).toEqual([GROUP_1, GROUP_2]);

    removeMember(store, GROUP_1, CONTACT_1);
    expect(listMembers(store, GROUP_1)).toHaveLength(0);
  });

  it('deleteContact and deleteGroup cascade memberships', () => {
    const store = createDevalboStore();

    setGroup(store, GROUP_1, {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setGroup(store, GROUP_2, {
      name: 'Org',
      groupType: 'organization',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, CONTACT_1, {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, CONTACT_2, {
      name: 'Jon User',
      uid: 'urn:uuid:3',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    addMember(store, { groupId: GROUP_1, contactId: CONTACT_1 });
    addMember(store, { groupId: GROUP_1, contactId: CONTACT_2 });
    addMember(store, { groupId: GROUP_2, contactId: CONTACT_1 });

    deleteContact(store, CONTACT_1);
    expect(listMembers(store, GROUP_1).map(({ row }) => row.contactId)).toEqual(['contact-2']);
    expect(listMembers(store, GROUP_2)).toEqual([]);

    deleteGroup(store, GROUP_1);
    expect(listMembers(store, GROUP_1)).toEqual([]);
  });

  it('rejects invalid persona/contact/group rows', () => {
    const store = createDevalboStore();

    expect(() => setPersona(store, BAD_PERSONA, {
      name: '',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    })).toThrow();

    expect(() => setContact(store, BAD_CONTACT, {
      name: 'Bad',
      uid: 'urn:uuid:3',
      kind: 'robot' as 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    })).toThrow();

    expect(() => setGroup(store, BAD_GROUP, {
      name: 'Bad Group',
      groupType: 'squad' as 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    })).toThrow();
  });

  it('rejects membership when group or contact does not exist', () => {
    const store = createDevalboStore();

    setGroup(store, GROUP_1, {
      name: 'Core Team',
      groupType: 'team',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(() => addMember(store, {
      groupId: GROUP_1,
      contactId: MISSING_CONTACT
    })).toThrow('Contact not found');

    setContact(store, CONTACT_1, {
      name: 'Jane User',
      uid: 'urn:uuid:2',
      kind: 'person',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });

    expect(() => addMember(store, {
      groupId: MISSING_GROUP,
      contactId: CONTACT_1
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
    expect(listMembers(store, GROUP_1)).toEqual([]);
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

    expect(getPersona(store, BAD_PERSONA)).toBeNull();
    expect(listPersonas(store)).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
