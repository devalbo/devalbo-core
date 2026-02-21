import { SolidLdpPersister } from './ldp-persister';
import {
  getDefaultPersona,
  groupToJsonLd,
  listContacts,
  listGroups,
  setContact,
  setDefaultPersona,
  setGroup,
  setPersona
} from '@devalbo/state';
import type { SolidSession } from './session';
import type { Store } from 'tinybase';

const derivePodRootFromWebId = (webId: string): string => {
  try {
    return `${new URL(webId).origin}/`;
  } catch {
    return '';
  }
};

export type PodPushResult = { podRoot: string; counts: { contacts: number; groups: number } };
export type PodPullResult = { podRoot: string; counts: { contacts: number; groups: number } };

export const podPush = async (store: Store, session: SolidSession, podNamespace: string): Promise<PodPushResult> => {
  const defaultPersona = getDefaultPersona(store);
  if (!defaultPersona) throw new Error('No default persona set');

  const podRoot = defaultPersona.row.storage || derivePodRootFromWebId(defaultPersona.id);
  if (!podRoot) throw new Error('Could not derive POD root');

  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);
  await persister.putPersona(defaultPersona.row, defaultPersona.id);

  const contacts = listContacts(store);
  for (const { id, row } of contacts) await persister.putContact(row, id);

  const groups = listGroups(store);
  for (const { id, row } of groups) await persister.putGroupJsonLd(id, groupToJsonLd(store, row, id));

  return { podRoot, counts: { contacts: contacts.length, groups: groups.length } };
};

export const podPull = async (store: Store, session: SolidSession, podNamespace: string): Promise<PodPullResult> => {
  const defaultPersona = getDefaultPersona(store);
  const podRoot = defaultPersona?.row.storage || derivePodRootFromWebId(defaultPersona?.id ?? session.webId);
  if (!podRoot) throw new Error('Could not derive POD root');

  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);

  const persona = await persister.getPersona();
  if (persona) {
    setPersona(store, persona.id, persona.row);
    // Bug fix: isDefault is local-only; set as default if no default exists after pull
    if (!getDefaultPersona(store)) {
      setDefaultPersona(store, persona.id);
    }
  }

  const contacts = await persister.listContacts();
  for (const { id, row } of contacts) setContact(store, id, row);

  // Bug fix: groups were not previously pulled
  const groups = await persister.listGroups();
  for (const { id, row } of groups) setGroup(store, id, row);

  return { podRoot, counts: { contacts: contacts.length, groups: groups.length } };
};
