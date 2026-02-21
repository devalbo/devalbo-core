import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type Store } from 'tinybase';
import {
  CONTACTS_TABLE,
  setContact,
  setPersona
} from '@devalbo/state';
import type { PersonaId } from '@devalbo/shared';
import { SolidLdpSynchronizer } from '../src/ldp-synchronizer';

const { persisterMocks } = vi.hoisted(() => ({
  persisterMocks: {
    putContact: vi.fn().mockResolvedValue(undefined),
    listContacts: vi.fn().mockResolvedValue([]),
    deleteContact: vi.fn().mockResolvedValue(undefined),
    putGroupJsonLd: vi.fn().mockResolvedValue(undefined),
    listGroups: vi.fn().mockResolvedValue([]),
    deleteGroup: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../src/ldp-persister', () => ({
  SolidLdpPersister: vi.fn(function MockSolidLdpPersister() {
    return persisterMocks;
  })
}));

const ALICE_ID = 'https://alice.example/#me' as PersonaId;

const mockSession = {
  isAuthenticated: true as const,
  webId: ALICE_ID,
  fetch: globalThis.fetch
};
const POD_NAMESPACE = 'devalbo';
const SOCIAL_SYNC_CONFIG = {
  pollIntervalMs: 10_000,
  outboundDebounceMs: 1_000
} as const;

const alicePersona = {
  name: 'Alice',
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
  storage: 'https://alice.example/',
  profileDoc: '',
  isDefault: true,
  updatedAt: '2024-01-01T00:00:00Z'
};

const contactRow = {
  name: 'Bob',
  uid: 'urn:uuid:bob',
  nickname: '',
  kind: 'person' as const,
  email: '',
  phone: '',
  url: '',
  photo: '',
  notes: '',
  organization: '',
  role: '',
  webId: '',
  agentCategory: '',
  linkedPersona: '',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('SolidLdpSynchronizer', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore();
    setPersona(store, ALICE_ID, alicePersona);
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throws when there is no default persona', () => {
    const emptyStore = createStore();
    expect(() => new SolidLdpSynchronizer(emptyStore, mockSession, POD_NAMESPACE, SOCIAL_SYNC_CONFIG)).toThrow(/no default persona/i);
  });

  it('start activates outbound listener behavior', async () => {
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, {
      ...SOCIAL_SYNC_CONFIG,
      pollIntervalMs: 60_000
    });
    sync.start();
    setContact(store, 'listener-bob', { ...contactRow, name: 'Listener Bob' });
    await vi.advanceTimersByTimeAsync(1_001);
    expect(persisterMocks.putContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Listener Bob' }),
      'listener-bob'
    );
    sync.stop();
  });

  it('stop disables outbound listener behavior', async () => {
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, SOCIAL_SYNC_CONFIG);
    sync.start();
    sync.stop();
    setContact(store, 'stopped-bob', { ...contactRow, name: 'Stopped Bob' });
    await vi.runAllTimersAsync();
    expect(persisterMocks.putContact).not.toHaveBeenCalled();
  });

  it('contact mutation triggers putContact after debounce', async () => {
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, {
      ...SOCIAL_SYNC_CONFIG,
      pollIntervalMs: 60_000
    });
    sync.start();
    setContact(store, 'bob-id', contactRow);
    expect(persisterMocks.putContact).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_001);
    expect(persisterMocks.putContact).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob' }), 'bob-id');
    sync.stop();
  });

  it('contact deletion triggers deleteContact after debounce', async () => {
    setContact(store, 'bob-id', contactRow);
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, {
      ...SOCIAL_SYNC_CONFIG,
      pollIntervalMs: 60_000
    });
    sync.start();
    store.delRow(CONTACTS_TABLE, 'bob-id');
    expect(persisterMocks.deleteContact).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_001);
    expect(persisterMocks.deleteContact).toHaveBeenCalledWith('bob-id');
    sync.stop();
  });

  it('poll updates local row when pod updatedAt is newer', async () => {
    setContact(store, 'bob-id', { ...contactRow, name: 'Bob Old', updatedAt: '2024-01-01T00:00:00Z' });
    persisterMocks.listContacts.mockResolvedValueOnce([{
      id: 'bob-id',
      row: { ...contactRow, name: 'Bob New', updatedAt: '2024-06-01T00:00:00Z' }
    }]);
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, SOCIAL_SYNC_CONFIG);
    sync.start();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(store.getRow(CONTACTS_TABLE, 'bob-id').name).toBe('Bob New');
    sync.stop();
  });

  it('poll does not overwrite when local updatedAt is newer', async () => {
    setContact(store, 'bob-id', { ...contactRow, name: 'Bob Local', updatedAt: '2024-12-01T00:00:00Z' });
    persisterMocks.listContacts.mockResolvedValueOnce([{
      id: 'bob-id',
      row: { ...contactRow, name: 'Bob Pod', updatedAt: '2024-01-01T00:00:00Z' }
    }]);
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, SOCIAL_SYNC_CONFIG);
    sync.start();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(store.getRow(CONTACTS_TABLE, 'bob-id').name).toBe('Bob Local');
    sync.stop();
  });

  it('inbound poll updates are suppressed from outbound flush', async () => {
    persisterMocks.listContacts.mockResolvedValueOnce([{
      id: 'bob-id',
      row: { ...contactRow, updatedAt: '2099-01-01T00:00:00Z' }
    }]);
    const sync = new SolidLdpSynchronizer(store, mockSession, POD_NAMESPACE, SOCIAL_SYNC_CONFIG);
    sync.start();
    await vi.advanceTimersByTimeAsync(10_001);
    expect(persisterMocks.putContact).not.toHaveBeenCalled();
    sync.stop();
  });
});
