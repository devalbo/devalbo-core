import type { Id, Store } from 'tinybase';
import {
  CONTACTS_TABLE,
  GROUPS_TABLE,
  getDefaultPersona,
  groupToJsonLd,
  listContacts as storeListContacts,
  listGroups as storeListGroups,
  setContact,
  setGroup
} from '@devalbo/state';
import type { ContactId, GroupId } from '@devalbo/shared';
import type { SolidSession } from './session';
import { SolidLdpPersister } from './ldp-persister';

const derivePodRootFromWebId = (webId: string): string => {
  try {
    return `${new URL(webId).origin}/`;
  } catch {
    return '';
  }
};

export class SolidLdpSynchronizer {
  private readonly persister: SolidLdpPersister;
  private readonly syncConfig: { pollIntervalMs: number; outboundDebounceMs: number };
  private listenerIds: Id[] = [];
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly pendingDeletes = new Map<string, Set<string>>([
    [CONTACTS_TABLE, new Set()],
    [GROUPS_TABLE, new Set()]
  ]);
  private suppressOutbound = false;

  constructor(
    private readonly store: Store,
    session: SolidSession,
    podNamespace: string,
    syncConfig: { pollIntervalMs: number; outboundDebounceMs: number }
  ) {
    this.syncConfig = syncConfig;
    const defaultPersona = getDefaultPersona(store);
    if (!defaultPersona) {
      throw new Error('SolidLdpSynchronizer: no default persona — cannot derive podRoot');
    }
    const podRoot = defaultPersona.row.storage || derivePodRootFromWebId(defaultPersona.id);
    this.persister = new SolidLdpPersister(podRoot, podNamespace, session.fetch);
  }

  start(): void {
    const contactsListenerId = this.store.addRowListener(CONTACTS_TABLE, null, (_store, _tableId, rowId) => {
      if (!this.store.hasRow(CONTACTS_TABLE, rowId)) {
        this.pendingDeletes.get(CONTACTS_TABLE)?.add(rowId);
      }
      this.scheduleFlush(CONTACTS_TABLE);
    });
    const groupsListenerId = this.store.addRowListener(GROUPS_TABLE, null, (_store, _tableId, rowId) => {
      if (!this.store.hasRow(GROUPS_TABLE, rowId)) {
        this.pendingDeletes.get(GROUPS_TABLE)?.add(rowId);
      }
      this.scheduleFlush(GROUPS_TABLE);
    });
    this.listenerIds = [contactsListenerId, groupsListenerId];
    this.pollIntervalId = setInterval(() => void this.poll(), this.syncConfig.pollIntervalMs);
  }

  stop(): void {
    for (const listenerId of this.listenerIds) this.store.delListener(listenerId);
    this.listenerIds = [];
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    for (const timer of this.flushTimers.values()) clearTimeout(timer);
    this.flushTimers.clear();
    this.pendingDeletes.forEach((set) => set.clear());
  }

  private scheduleFlush(tableId: string): void {
    if (this.suppressOutbound) return;
    const existing = this.flushTimers.get(tableId);
    if (existing) clearTimeout(existing);
    const timerId = setTimeout(() => void this.flushTable(tableId), this.syncConfig.outboundDebounceMs);
    this.flushTimers.set(tableId, timerId);
  }

  private async flushTable(tableId: string): Promise<void> {
    this.flushTimers.delete(tableId);
    const deletes = this.pendingDeletes.get(tableId) ?? new Set();
    this.pendingDeletes.set(tableId, new Set());
    try {
      if (tableId === CONTACTS_TABLE) {
        for (const { id, row } of storeListContacts(this.store)) {
          await this.persister.putContact(row, id);
        }
        for (const id of deletes) {
          await this.persister.deleteContact(id as ContactId);
        }
      } else if (tableId === GROUPS_TABLE) {
        for (const { id, row } of storeListGroups(this.store)) {
          await this.persister.putGroupJsonLd(id, groupToJsonLd(this.store, row, id));
        }
        for (const id of deletes) {
          await this.persister.deleteGroup(id as GroupId);
        }
      }
    } catch (error) {
      console.warn(`[SolidLdpSynchronizer] outbound flush failed for "${tableId}":`, error);
    }
  }

  private async poll(): Promise<void> {
    this.suppressOutbound = true;
    try {
      const podContacts = await this.persister.listContacts();
      for (const { id, row } of podContacts) {
        const localRow = this.store.getRow(CONTACTS_TABLE, id);
        const localUpdatedAt = typeof localRow?.updatedAt === 'string' ? localRow.updatedAt : '';
        if (!localUpdatedAt || (row.updatedAt && row.updatedAt > localUpdatedAt)) {
          setContact(this.store, id, row);
        }
      }

      const podGroups = await this.persister.listGroups();
      for (const { id, row } of podGroups) {
        const localRow = this.store.getRow(GROUPS_TABLE, id);
        const localUpdatedAt = typeof localRow?.updatedAt === 'string' ? localRow.updatedAt : '';
        if (!localUpdatedAt || (row.updatedAt && row.updatedAt > localUpdatedAt)) {
          setGroup(this.store, id, row);
        }
      }
    } catch (error) {
      console.warn('[SolidLdpSynchronizer] inbound poll failed:', error);
    } finally {
      this.suppressOutbound = false;
    }
  }
}
