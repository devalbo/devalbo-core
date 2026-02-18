import type {
  ContactId,
  ContactRow,
  GroupId,
  GroupRow,
  PersonaId,
  PersonaRow
} from '@devalbo/shared';
import { getContact } from '../accessors/contacts';
import { getGroup } from '../accessors/groups';
import { getPersona } from '../accessors/personas';
import { CONTACTS_TABLE, GROUPS_TABLE, PERSONAS_TABLE } from '../schemas/social';
import { useRow } from './use-row';
import { useStore } from './use-store';

export const usePersona = (id: PersonaId): PersonaRow | null => {
  const store = useStore();
  useRow(PERSONAS_TABLE, id);
  return getPersona(store, id);
};

export const useContact = (id: ContactId): ContactRow | null => {
  const store = useStore();
  useRow(CONTACTS_TABLE, id);
  return getContact(store, id);
};

export const useGroup = (id: GroupId): GroupRow | null => {
  const store = useStore();
  useRow(GROUPS_TABLE, id);
  return getGroup(store, id);
};
