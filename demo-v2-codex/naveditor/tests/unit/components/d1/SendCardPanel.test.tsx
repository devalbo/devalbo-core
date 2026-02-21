import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreContext, createDevalboStore, setContact, setPersona } from '@devalbo/state';
import { unsafeAsContactId, unsafeAsPersonaId } from '@devalbo/shared';
import type { ProfileFetchResult, SolidSession } from '@devalbo/solid-client';
import { SendCardPanel } from '@/components/social/d1/SendCardPanel';

const { fetchWebIdProfileMock, deliverCardMock } = vi.hoisted(() => ({
  fetchWebIdProfileMock: vi.fn<(webId: string) => Promise<ProfileFetchResult>>(),
  deliverCardMock: vi.fn<() => Promise<{ ok: true } | { ok: false; error: string }>>()
}));

vi.mock('@devalbo/solid-client', () => ({
  fetchWebIdProfile: fetchWebIdProfileMock,
  deliverCard: deliverCardMock
}));

const personaRow = {
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
  updatedAt: '2026-02-19T00:00:00.000Z'
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
  webId: 'https://bob.example/#me',
  agentCategory: '',
  linkedPersona: '',
  updatedAt: '2026-02-19T00:00:00.000Z'
};

const session: SolidSession = {
  isAuthenticated: true,
  webId: 'https://alice.example/#me',
  fetch: globalThis.fetch
};

describe('SendCardPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(() => {
    store = createDevalboStore();
    fetchWebIdProfileMock.mockReset();
    deliverCardMock.mockReset();
  });

  it('returns null when contact has no webId', async () => {
    const personaId = unsafeAsPersonaId('persona_1');
    const contactId = unsafeAsContactId('contact_1');
    setPersona(store, personaId, personaRow);
    setContact(store, contactId, { ...contactRow, webId: '' });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SendCardPanel personaId={personaId} contactId={contactId} session={session} />
        </StoreContext.Provider>
      );
    });

    expect(renderer.toJSON()).toBeNull();
    expect(deliverCardMock).not.toHaveBeenCalled();
  });

  it('disables send when persona has no resolvable WebID', async () => {
    const personaId = unsafeAsPersonaId('persona_uuid_only');
    const contactId = unsafeAsContactId('contact_1');
    setPersona(store, personaId, { ...personaRow, profileDoc: '' });
    setContact(store, contactId, contactRow);

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SendCardPanel personaId={personaId} contactId={contactId} session={session} />
        </StoreContext.Provider>
      );
    });

    const button = renderer.root.findByType('button');
    expect(button.props.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('needs a WebID');
  });

  it('enables send when persona has profileDoc URL', async () => {
    const personaId = unsafeAsPersonaId('persona_uuid_only');
    const contactId = unsafeAsContactId('contact_1');
    setPersona(store, personaId, { ...personaRow, profileDoc: 'https://alice.example/profile/card#me' });
    setContact(store, contactId, contactRow);

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SendCardPanel personaId={personaId} contactId={contactId} session={session} />
        </StoreContext.Provider>
      );
    });

    expect(renderer.root.findByType('button').props.disabled).toBe(false);
  });

  it('shows fetch profile error', async () => {
    const personaId = unsafeAsPersonaId('https://alice.example/#me');
    const contactId = unsafeAsContactId('contact_1');
    setPersona(store, personaId, { ...personaRow, profileDoc: '' });
    setContact(store, contactId, contactRow);
    fetchWebIdProfileMock.mockResolvedValueOnce({ ok: false, error: 'boom' });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SendCardPanel personaId={personaId} contactId={contactId} session={session} />
        </StoreContext.Provider>
      );
    });

    await act(async () => {
      await renderer.root.findByType('button').props.onClick();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Could not fetch contact profile: boom');
  });

  it('shows inbox-missing error', async () => {
    const personaId = unsafeAsPersonaId('https://alice.example/#me');
    const contactId = unsafeAsContactId('contact_1');
    setPersona(store, personaId, personaRow);
    setContact(store, contactId, contactRow);
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true,
      id: 'https://bob.example/#me',
      row: {
        ...personaRow,
        name: 'Bob',
        isDefault: false,
        inbox: ''
      }
    });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SendCardPanel personaId={personaId} contactId={contactId} session={session} />
        </StoreContext.Provider>
      );
    });

    await act(async () => {
      await renderer.root.findByType('button').props.onClick();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain("does not list an inbox");
  });

  it('calls deliverCard with actorWebId and shows success', async () => {
    const personaId = unsafeAsPersonaId('persona_uuid_only');
    const contactId = unsafeAsContactId('contact_1');
    setPersona(store, personaId, { ...personaRow, profileDoc: 'https://alice.example/profile/card#me' });
    setContact(store, contactId, contactRow);
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true,
      id: 'https://bob.example/#me',
      row: {
        ...personaRow,
        name: 'Bob',
        isDefault: false,
        inbox: 'https://bob.example/inbox'
      }
    });
    deliverCardMock.mockResolvedValueOnce({ ok: true });

    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <SendCardPanel personaId={personaId} contactId={contactId} session={session} />
        </StoreContext.Provider>
      );
    });

    await act(async () => {
      await renderer.root.findByType('button').props.onClick();
    });

    expect(deliverCardMock).toHaveBeenCalledWith(
      'https://bob.example/inbox',
      'https://alice.example/profile/card#me',
      'https://bob.example/#me',
      expect.any(Object),
      session.fetch
    );
    expect(JSON.stringify(renderer.toJSON())).toContain('Card sent to Bob');
  });
});
