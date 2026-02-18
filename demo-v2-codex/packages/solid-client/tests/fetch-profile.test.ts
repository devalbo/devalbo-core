import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWebIdProfile } from '../src/fetch-profile';

afterEach(() => {
  vi.restoreAllMocks();
});

const WEB_ID = 'https://alice.example/profile/card#me';

const mockFetch = (body: unknown, options: { status?: number; contentType?: string; statusText?: string } = {}) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: options.status ?? 200,
      statusText: options.statusText ?? (options.status === 404 ? 'Not Found' : 'OK'),
      headers: { 'Content-Type': options.contentType ?? 'application/ld+json' }
    })
  );
};

describe('fetchWebIdProfile', () => {
  it('returns network error when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('boom'));
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.startsWith('Network error:')).toBe(true);
  });

  it('returns HTTP status failure', async () => {
    mockFetch({}, { status: 404, statusText: 'Not Found' });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result).toEqual({ ok: false, error: 'HTTP 404: Not Found' });
  });

  it('returns content type error for non-json payload', async () => {
    mockFetch('@prefix foaf: <http://xmlns.com/foaf/0.1/> .', { contentType: 'text/turtle' });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not JSON-LD');
  });

  it('parses shape A single-object profile', async () => {
    mockFetch({
      '@context': { foaf: 'http://xmlns.com/foaf/0.1/' },
      '@id': WEB_ID,
      'foaf:name': 'Alice'
    });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.name).toBe('Alice');
  });

  it('parses shape B array profile', async () => {
    mockFetch([
      { '@id': 'https://alice.example/profile/card', 'foaf:name': 'Not me' },
      { '@id': WEB_ID, 'foaf:name': 'Alice Array' }
    ]);
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.name).toBe('Alice Array');
  });

  it('parses shape C graph profile and inherits context', async () => {
    mockFetch({
      '@context': { foaf: 'http://xmlns.com/foaf/0.1/' },
      '@graph': [
        { '@id': WEB_ID, 'foaf:name': 'Alice Graph' }
      ]
    });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.name).toBe('Alice Graph');
  });

  it('parses IRI-valued fields from node references', async () => {
    mockFetch({
      '@context': { foaf: 'http://xmlns.com/foaf/0.1/', solid: 'http://www.w3.org/ns/solid/terms#' },
      '@id': WEB_ID,
      'foaf:name': 'Alice',
      'solid:oidcIssuer': { '@id': 'https://issuer.example' }
    });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.oidcIssuer).toBe('https://issuer.example');
  });

  it('returns validation error when foaf:name is missing', async () => {
    mockFetch({
      '@context': {},
      '@id': WEB_ID
    });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('missing required foaf:name');
  });

  it('returns node-not-found error when webId is absent', async () => {
    mockFetch({
      '@context': {},
      '@id': 'https://alice.example/profile/card'
    });
    const result = await fetchWebIdProfile(WEB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does not contain a node');
  });
});
