import { describe, expect, it, vi } from 'vitest';
import { commands } from '@/commands';
import type { ProfileFetchResult } from '@devalbo/solid-client';

const { fetchWebIdProfileMock } = vi.hoisted(() => ({
  fetchWebIdProfileMock: vi.fn<(webId: string) => Promise<ProfileFetchResult>>()
}));

vi.mock('@devalbo/solid-client', () => ({
  fetchWebIdProfile: fetchWebIdProfileMock
}));

describe('solid-fetch-profile command', () => {
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
