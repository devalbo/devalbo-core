import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/commands';
import type { ProfileFetchResult } from '@devalbo/solid-client';
import { createDevalboStore, getDefaultPersona, listGroups, setContact, setPersona } from '@devalbo/state';
import type { PersonaId } from '@devalbo/shared';

const {
  fetchWebIdProfileMock,
  solidLoginMock,
  solidLogoutMock,
  deliverCardMock,
  persisterFactory
} = vi.hoisted(() => ({
  fetchWebIdProfileMock: vi.fn<(webId: string) => Promise<ProfileFetchResult>>(),
  solidLoginMock: vi.fn<(issuer: string) => Promise<unknown>>(),
  solidLogoutMock: vi.fn<() => Promise<void>>(),
  deliverCardMock: vi.fn<() => Promise<{ ok: true } | { ok: false; error: string }>>(),
  persisterFactory: vi.fn(function MockSolidLdpPersister() {
    return {
      putPersona: vi.fn().mockResolvedValue(undefined),
      getPersona: vi.fn().mockResolvedValue(null),
      putContact: vi.fn().mockResolvedValue(undefined),
      listContacts: vi.fn().mockResolvedValue([]),
      listGroups: vi.fn().mockResolvedValue([]),
      putGroupJsonLd: vi.fn().mockResolvedValue(undefined)
    };
  })
}));

vi.mock('@devalbo/solid-client', () => ({
  fetchWebIdProfile: fetchWebIdProfileMock,
  solidLogin: solidLoginMock,
  solidLogout: solidLogoutMock,
  deliverCard: deliverCardMock,
  SolidLdpPersister: persisterFactory
}));

const jsonOf = (value: unknown): string => JSON.stringify(value);

const mockSession = {
  isAuthenticated: true as const,
  webId: 'https://alice.example/#me',
  fetch: globalThis.fetch
};

const emptyPersonaRow = {
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
  storage: '',
  profileDoc: '',
  isDefault: true,
  updatedAt: ''
};

const emptyContactRow = {
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
  updatedAt: ''
};

const emptyGroupRow = {
  name: 'Close Friends',
  groupType: 'group' as const,
  description: '',
  url: '',
  logo: '',
  parentGroup: '',
  updatedAt: ''
};

const emptyProfileRow = {
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
  storage: '',
  profileDoc: '',
  isDefault: false,
  updatedAt: ''
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('solid-fetch-profile', () => {
  it('returns usage error when webId is missing', async () => {
    const result = await commands['solid-fetch-profile']([]);
    expect(result.error).toBeTruthy();
  });

  it('returns validation error for non-url input', async () => {
    const result = await commands['solid-fetch-profile'](['not-a-url']);
    expect(result.error).toBeTruthy();
  });

  it('returns output component on successful fetch', async () => {
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true,
      id: 'https://alice.example/profile/card#me',
      row: {
        name: 'Alice',
        nickname: '',
        givenName: '',
        familyName: '',
        email: 'mailto:alice@example.com',
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
        updatedAt: ''
      }
    });

    const result = await commands['solid-fetch-profile'](['https://alice.example/profile/card#me']);
    expect(result.error).toBeUndefined();
    expect(result.component).toBeTruthy();
  });
});

describe('solid auth commands', () => {
  it('solid-login returns usage error when issuer is missing', async () => {
    const result = await commands['solid-login']([]);
    expect(result.error).toBeTruthy();
  });

  it('solid-login returns validation error for invalid issuer', async () => {
    const result = await commands['solid-login'](['not-a-url']);
    expect(result.error).toBeTruthy();
  });

  it('solid-login succeeds with a valid issuer', async () => {
    solidLoginMock.mockResolvedValueOnce(null);
    const result = await commands['solid-login'](['https://solidcommunity.net']);
    expect(result.error).toBeUndefined();
    expect(result.component).toBeTruthy();
  });

  it('solid-logout calls logout and returns output', async () => {
    solidLogoutMock.mockResolvedValueOnce();
    const result = await commands['solid-logout']([]);
    expect(solidLogoutMock).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.component).toBeTruthy();
  });

  it('solid-whoami returns Not logged in when session is null', async () => {
    const result = await commands['solid-whoami']([], { session: null });
    expect(jsonOf(result.component)).toContain('Not logged in');
  });

  it('solid-whoami returns session webId when authenticated', async () => {
    const result = await commands['solid-whoami']([], { session: mockSession });
    expect(jsonOf(result.component)).toContain('https://alice.example/#me');
  });
});

describe('solid-pod commands', () => {
  it('solid-pod-push returns error when not logged in', async () => {
    const store = createDevalboStore();
    const result = await commands['solid-pod-push']([], { store, session: null });
    expect(result.error).toContain('Not logged in');
  });

  it('solid-pod-push returns error when no default persona exists', async () => {
    const store = createDevalboStore();
    const result = await commands['solid-pod-push']([], { store, session: mockSession });
    expect(result.error).toContain('No default persona');
  });

  it('solid-pod-push calls persister methods on happy path', async () => {
    const store = createDevalboStore();
    setPersona(store, 'https://alice.example/#me' as PersonaId, emptyPersonaRow);
    setContact(store, 'contact-1', { ...emptyContactRow, webId: 'https://bob.example/#me' });
    const result = await commands['solid-pod-push']([], { store, session: mockSession });
    expect(result.error).toBeUndefined();
    expect(persisterFactory).toHaveBeenCalledTimes(1);
    const instance = persisterFactory.mock.results[0]?.value as {
      putPersona: ReturnType<typeof vi.fn>;
      putContact: ReturnType<typeof vi.fn>;
    };
    expect(instance.putPersona).toHaveBeenCalledTimes(1);
    expect(instance.putContact).toHaveBeenCalledTimes(1);
  });

  it('solid-pod-pull returns error when not logged in', async () => {
    const store = createDevalboStore();
    const result = await commands['solid-pod-pull']([], { store, session: null });
    expect(result.error).toContain('Not logged in');
  });

  it('solid-pod-pull pulls groups and sets default persona when none exists', async () => {
    const store = createDevalboStore();
    const instance = {
      getPersona: vi.fn().mockResolvedValue({ id: 'https://alice.example/profile/card#me', row: { ...emptyPersonaRow, isDefault: false } }),
      listContacts: vi.fn().mockResolvedValue([]),
      listGroups: vi.fn().mockResolvedValue([{ id: 'group-1', row: emptyGroupRow }])
    };
    persisterFactory.mockImplementationOnce(function MockSolidLdpPersister() {
      return instance as unknown as object;
    });

    const result = await commands['solid-pod-pull']([], { store, session: mockSession });

    expect(result.error).toBeUndefined();
    expect(instance.listGroups).toHaveBeenCalledTimes(1);
    expect(listGroups(store)).toHaveLength(1);
    expect(getDefaultPersona(store)?.id).toBe('https://alice.example/profile/card#me');
  });
});

describe('solid-share-card', () => {
  it('returns error when contactId arg is missing', async () => {
    const store = createDevalboStore();
    const result = await commands['solid-share-card']([], { store, session: mockSession });
    expect(result.error).toBeTruthy();
  });

  it('returns error when not logged in', async () => {
    const store = createDevalboStore();
    const result = await commands['solid-share-card'](['bob-id'], { store, session: null });
    expect(result.error).toContain('Not logged in');
  });

  it('returns error when contact is missing', async () => {
    const store = createDevalboStore();
    const result = await commands['solid-share-card'](['missing'], { store, session: mockSession });
    expect(result.error).toContain('Contact not found');
  });

  it('returns error when contact has no webId', async () => {
    const store = createDevalboStore();
    setContact(store, 'bob-id', { ...emptyContactRow, webId: '' });
    const result = await commands['solid-share-card'](['bob-id'], { store, session: mockSession });
    expect(result.error).toContain('no WebID');
  });

  it('returns error when contact profile has no inbox', async () => {
    const store = createDevalboStore();
    setContact(store, 'bob-id', { ...emptyContactRow, webId: 'https://bob.example/#me' });
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true,
      id: 'https://bob.example/#me',
      row: { ...emptyProfileRow, inbox: '' }
    });
    const result = await commands['solid-share-card'](['bob-id'], { store, session: mockSession });
    expect(result.error).toContain('does not list an inbox');
  });

  it('calls deliverCard on happy path', async () => {
    const store = createDevalboStore();
    setContact(store, 'bob-id', { ...emptyContactRow, webId: 'https://bob.example/#me' });
    setPersona(store, 'https://alice.example/#me' as PersonaId, emptyPersonaRow);
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true,
      id: 'https://bob.example/#me',
      row: { ...emptyProfileRow, inbox: 'https://bob.example/inbox' }
    });
    deliverCardMock.mockResolvedValueOnce({ ok: true });
    const result = await commands['solid-share-card'](['bob-id'], { store, session: mockSession });
    expect(deliverCardMock).toHaveBeenCalledWith(
      'https://bob.example/inbox',
      'https://alice.example/#me',
      'https://bob.example/#me',
      expect.any(Object),
      mockSession.fetch
    );
    expect(result.error).toBeUndefined();
  });
});
