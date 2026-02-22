import { SolidLdpPersister, type SolidSession } from '@devalbo/solid-client';
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
import type { Store } from 'tinybase';

export type PodSyncSummary = {
  podRoot: string;
  counts: {
    persona: number;
    contacts: number;
    groups: number;
  };
};

export const derivePodRootFromWebId = (webId: string): string => {
  try {
    return `${new URL(webId).origin}/`;
  } catch {
    return '';
  }
};

export const pushPodData = async (store: Store, session: SolidSession, podNamespace: string): Promise<PodSyncSummary> => {
  const defaultPersona = getDefaultPersona(store);
  if (!defaultPersona) {
    throw new Error('No default persona set. Run: persona set-default <id>');
  }

  const podRoot = defaultPersona.row.storage || derivePodRootFromWebId(defaultPersona.id);
  if (!podRoot) {
    throw new Error('Could not derive POD root.');
  }

  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);
  await persister.putPersona(defaultPersona.row, defaultPersona.id);

  const contacts = listContacts(store);
  for (const { id, row } of contacts) {
    await persister.putContact(row, id);
  }

  const groups = listGroups(store);
  for (const { id, row } of groups) {
    await persister.putGroupJsonLd(id, groupToJsonLd(store, row, id));
  }

  return {
    podRoot,
    counts: {
      persona: 1,
      contacts: contacts.length,
      groups: groups.length
    }
  };
};

export const pullPodData = async (store: Store, session: SolidSession, podNamespace: string): Promise<PodSyncSummary> => {
  const defaultPersona = getDefaultPersona(store);
  const podRoot = defaultPersona?.row.storage || derivePodRootFromWebId(defaultPersona?.id ?? session.webId);
  if (!podRoot) {
    throw new Error('Could not derive POD root.');
  }

  const persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);

  const persona = await persister.getPersona();
  if (persona) {
    setPersona(store, persona.id, persona.row);
    if (!getDefaultPersona(store)) {
      setDefaultPersona(store, persona.id);
    }
  }

  const contacts = await persister.listContacts();
  for (const { id, row } of contacts) {
    setContact(store, id, row);
  }

  const groups = await persister.listGroups();
  for (const { id, row } of groups) {
    setGroup(store, id, row);
  }

  return {
    podRoot,
    counts: {
      persona: persona ? 1 : 0,
      contacts: contacts.length,
      groups: groups.length
    }
  };
};
