import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { ContactId, GroupId, PersonaId } from '@devalbo/shared';
import { unsafeAsContactId, unsafeAsGroupId, unsafeAsPersonaId } from '@devalbo/shared';
import {
  addMember,
  createDevalboStore,
  setContact,
  setGroup,
  setPersona,
  StoreContext,
  useContact,
  useContacts,
  useGroup,
  useGroups,
  useMemberships,
  usePersona,
  usePersonas
} from '../src';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const PERSONA_ID = unsafeAsPersonaId('persona-test') as PersonaId;
const CONTACT_ID = unsafeAsContactId('contact-test') as ContactId;
const GROUP_ID = unsafeAsGroupId('group-test') as GroupId;

const seedPersona = (store: ReturnType<typeof createDevalboStore>, id: PersonaId, name: string) => {
  setPersona(store, id, {
    name,
    isDefault: false,
    updatedAt: '2026-02-18T00:00:00.000Z'
  });
};

const seedContact = (store: ReturnType<typeof createDevalboStore>, id: ContactId, name: string) => {
  setContact(store, id, {
    name,
    uid: `urn:uuid:${id}`,
    kind: 'person',
    updatedAt: '2026-02-18T00:00:00.000Z'
  });
};

const seedGroup = (store: ReturnType<typeof createDevalboStore>, id: GroupId, name: string) => {
  setGroup(store, id, {
    name,
    groupType: 'group',
    updatedAt: '2026-02-18T00:00:00.000Z'
  });
};

describe('social hooks', () => {
  const listHookCases = [
    {
      name: 'usePersonas',
      hookFn: usePersonas,
      seed: (store: ReturnType<typeof createDevalboStore>) => seedPersona(store, PERSONA_ID, 'Alice')
    },
    {
      name: 'useContacts',
      hookFn: useContacts,
      seed: (store: ReturnType<typeof createDevalboStore>) => seedContact(store, CONTACT_ID, 'Bob')
    },
    {
      name: 'useGroups',
      hookFn: useGroups,
      seed: (store: ReturnType<typeof createDevalboStore>) => seedGroup(store, GROUP_ID, 'Core Team')
    }
  ] as const;

  for (const { name, hookFn, seed } of listHookCases) {
    describe(name, () => {
      it('returns empty array when table is empty', async () => {
        const store = createDevalboStore();
        let latest: ReturnType<typeof hookFn> | undefined;

        function HookHarness() {
          latest = hookFn();
          return null;
        }

        await act(async () => {
          create(
            <StoreContext.Provider value={store}>
              <HookHarness />
            </StoreContext.Provider>
          );
          await flush();
        });

        expect(latest).toEqual([]);
      });

      it('returns typed rows after seeding', async () => {
        const store = createDevalboStore();
        seed(store);
        let latest: ReturnType<typeof hookFn> | undefined;

        function HookHarness() {
          latest = hookFn();
          return null;
        }

        await act(async () => {
          create(
            <StoreContext.Provider value={store}>
              <HookHarness />
            </StoreContext.Provider>
          );
          await flush();
        });

        expect(latest).toHaveLength(1);
      });

      it('triggers re-render on row addition and mutation', async () => {
        const store = createDevalboStore();
        const snapshots: number[] = [];

        function HookHarness() {
          const value = hookFn();
          snapshots.push(value.length);
          return null;
        }

        await act(async () => {
          create(
            <StoreContext.Provider value={store}>
              <HookHarness />
            </StoreContext.Provider>
          );
          await flush();
        });

        await act(async () => {
          seed(store);
          await flush();
        });

        await act(async () => {
          seed(store);
          await flush();
        });

        expect(snapshots.some((count) => count === 0)).toBe(true);
        expect(snapshots.some((count) => count === 1)).toBe(true);
      });
    });
  }

  const entityHookCases = [
    {
      name: 'usePersona',
      hookFn: usePersona,
      id: PERSONA_ID,
      seed: (store: ReturnType<typeof createDevalboStore>) => seedPersona(store, PERSONA_ID, 'Alice'),
      mutate: (store: ReturnType<typeof createDevalboStore>) => seedPersona(store, PERSONA_ID, 'Alice Updated')
    },
    {
      name: 'useContact',
      hookFn: useContact,
      id: CONTACT_ID,
      seed: (store: ReturnType<typeof createDevalboStore>) => seedContact(store, CONTACT_ID, 'Bob'),
      mutate: (store: ReturnType<typeof createDevalboStore>) => seedContact(store, CONTACT_ID, 'Bob Updated')
    },
    {
      name: 'useGroup',
      hookFn: useGroup,
      id: GROUP_ID,
      seed: (store: ReturnType<typeof createDevalboStore>) => seedGroup(store, GROUP_ID, 'Core Team'),
      mutate: (store: ReturnType<typeof createDevalboStore>) => seedGroup(store, GROUP_ID, 'Core Team Updated')
    }
  ] as const;

  for (const { name, hookFn, id, seed, mutate } of entityHookCases) {
    describe(name, () => {
      it('returns null for unknown id', async () => {
        const store = createDevalboStore();
        let latest: ReturnType<typeof hookFn> | undefined;

        function HookHarness() {
          latest = hookFn(id);
          return null;
        }

        await act(async () => {
          create(
            <StoreContext.Provider value={store}>
              <HookHarness />
            </StoreContext.Provider>
          );
          await flush();
        });

        expect(latest).toBeNull();
      });

      it('returns the row after seeding', async () => {
        const store = createDevalboStore();
        seed(store);
        let latest: ReturnType<typeof hookFn> | undefined;

        function HookHarness() {
          latest = hookFn(id);
          return null;
        }

        await act(async () => {
          create(
            <StoreContext.Provider value={store}>
              <HookHarness />
            </StoreContext.Provider>
          );
          await flush();
        });

        expect(latest).not.toBeNull();
      });

      it('updates when the row is mutated', async () => {
        const store = createDevalboStore();
        seed(store);
        const names: string[] = [];

        function HookHarness() {
          const value = hookFn(id);
          if (value && 'name' in value) names.push(value.name);
          return null;
        }

        await act(async () => {
          create(
            <StoreContext.Provider value={store}>
              <HookHarness />
            </StoreContext.Provider>
          );
          await flush();
        });

        await act(async () => {
          mutate(store);
          await flush();
        });

        expect(names.length).toBeGreaterThan(1);
        expect(names.at(-1)).toMatch(/Updated/);
      });
    });
  }

  it('supports groupId/contactId filters in useMemberships', async () => {
    const store = createDevalboStore();
    const secondGroupId = unsafeAsGroupId('group-2') as GroupId;
    const secondContactId = unsafeAsContactId('contact-2') as ContactId;

    seedGroup(store, GROUP_ID, 'Core Team');
    seedGroup(store, secondGroupId, 'Staff');
    seedContact(store, CONTACT_ID, 'Alice');
    seedContact(store, secondContactId, 'Bob');
    addMember(store, { groupId: GROUP_ID, contactId: CONTACT_ID, role: 'lead' });
    addMember(store, { groupId: secondGroupId, contactId: CONTACT_ID, role: 'member' });

    let byGroup: ReturnType<typeof useMemberships> | undefined;
    let byContact: ReturnType<typeof useMemberships> | undefined;

    function HookHarness() {
      byGroup = useMemberships({ groupId: GROUP_ID });
      byContact = useMemberships({ contactId: CONTACT_ID });
      return null;
    }

    await act(async () => {
      create(
        <StoreContext.Provider value={store}>
          <HookHarness />
        </StoreContext.Provider>
      );
      await flush();
    });

    expect(byGroup).toHaveLength(1);
    expect(byContact).toHaveLength(2);
  });
});
