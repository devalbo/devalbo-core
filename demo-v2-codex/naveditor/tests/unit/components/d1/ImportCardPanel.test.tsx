import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreContext, createDevalboStore, listContacts } from '@devalbo/state';
import { ImportCardPanel } from '@/components/social/d1/ImportCardPanel';
import type { ProfileFetchResult } from '@devalbo/solid-client';

const { fetchWebIdProfileMock } = vi.hoisted(() => ({
  fetchWebIdProfileMock: vi.fn<(webId: string) => Promise<ProfileFetchResult>>()
}));

vi.mock('@devalbo/solid-client', () => ({
  fetchWebIdProfile: fetchWebIdProfileMock
}));

describe('ImportCardPanel', () => {
  let store = createDevalboStore();
  let renderer!: ReactTestRenderer;

  beforeEach(async () => {
    fetchWebIdProfileMock.mockReset();
    store = createDevalboStore();
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ImportCardPanel />
        </StoreContext.Provider>
      );
    });
  });

  it('shows error on empty submit', async () => {
    const button = renderer.root.findByType('button');
    await act(async () => {
      button.props.onClick();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Paste some JSON-LD');
  });

  it('shows error on invalid json', async () => {
    const textarea = renderer.root.findByType('textarea');
    const button = renderer.root.findByType('button');
    await act(async () => {
      textarea.props.onChange({ target: { value: 'not-json' } });
    });
    await act(async () => {
      button.props.onClick();
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Error');
  });

  it('imports valid contact json-ld and calls callback', async () => {
    let importedId = '';
    await act(async () => {
      renderer = create(
        <StoreContext.Provider value={store}>
          <ImportCardPanel onImported={(id) => { importedId = id; }} />
        </StoreContext.Provider>
      );
    });

    const json = JSON.stringify({
      '@context': {},
      '@type': 'vcard:Individual',
      '@id': 'contact_d1_import',
      'vcard:fn': 'Bob',
      'vcard:hasUID': 'urn:uuid:bob'
    });

    const textarea = renderer.root.findByType('textarea');
    const button = renderer.root.findByType('button');

    await act(async () => {
      textarea.props.onChange({ target: { value: json } });
    });
    await act(async () => {
      button.props.onClick();
    });

    expect(importedId).toBe('contact_d1_import');
    expect(listContacts(store)).toHaveLength(1);
    expect(listContacts(store)[0]?.row.name).toBe('Bob');
  });

  it('imports from WebID URL on success', async () => {
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: true,
      id: 'https://bob.example/profile/card#me',
      row: {
        name: 'Bob',
        nickname: '',
        givenName: '',
        familyName: '',
        email: 'mailto:bob@example.com',
        phone: '',
        image: '',
        bio: '',
        homepage: 'https://bob.example',
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

    const textarea = renderer.root.findByType('textarea');
    const button = renderer.root.findByType('button');
    await act(async () => {
      textarea.props.onChange({ target: { value: 'https://bob.example/profile/card#me' } });
    });
    await act(async () => {
      await button.props.onClick();
    });

    expect(fetchWebIdProfileMock).toHaveBeenCalledWith('https://bob.example/profile/card#me');
    expect(listContacts(store)).toHaveLength(1);
    expect(listContacts(store)[0]?.row.name).toBe('Bob');
    expect(JSON.stringify(renderer.toJSON())).toContain('Imported WebID profile: Bob');
  });

  it('shows WebID fetch error and does not add contact', async () => {
    fetchWebIdProfileMock.mockResolvedValueOnce({
      ok: false,
      error: 'Network error: failed.'
    });

    const textarea = renderer.root.findByType('textarea');
    const button = renderer.root.findByType('button');
    await act(async () => {
      textarea.props.onChange({ target: { value: 'https://bob.example/profile/card#me' } });
    });
    await act(async () => {
      await button.props.onClick();
    });

    expect(fetchWebIdProfileMock).toHaveBeenCalledWith('https://bob.example/profile/card#me');
    expect(listContacts(store)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain('Network error: failed.');
  });
});
