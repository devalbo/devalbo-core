import { afterEach, describe, expect, it, vi } from 'vitest';
import { SolidLdpPersister } from '../src/ldp-persister';

const POD_ROOT = 'https://alice.example/';
const POD_NAMESPACE = 'devalbo';
const PERSONA_ID = 'https://alice.example/profile/card#me';

const jsonResponse = (body: unknown, status = 200, headers: HeadersInit = { 'Content-Type': 'application/ld+json' }) =>
  new Response(JSON.stringify(body), { status, headers });

const emptyResponse = (status: number, headers?: HeadersInit) => new Response(null, { status, headers });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SolidLdpPersister', () => {
  it('putContact sends PUT to encoded contact resource URL', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(200))
      .mockResolvedValueOnce(emptyResponse(201));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);

    await persister.putContact({
      name: 'Bob',
      uid: 'urn:uuid:bob',
      nickname: '',
      kind: 'person',
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
    }, 'contact/id with space');

    const [, putInit] = fetchFn.mock.calls[1] ?? [];
    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://alice.example/devalbo/contacts/contact%2Fid%20with%20space.jsonld');
    expect((putInit as RequestInit).method).toBe('PUT');
    expect((putInit as RequestInit).headers).toEqual({ 'Content-Type': 'application/ld+json' });
  });

  it('deleteContact sends DELETE to contact resource URL', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(204));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await persister.deleteContact('contact-1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://alice.example/devalbo/contacts/contact-1.jsonld',
      { method: 'DELETE' }
    );
  });

  it('deleteContact does not throw on 404', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(404));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await expect(persister.deleteContact('missing')).resolves.toBeUndefined();
  });

  it('getPersona returns null on 404', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(404));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await expect(persister.getPersona()).resolves.toBeNull();
  });

  it('getPersona parses persona JSON-LD response', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      '@id': PERSONA_ID,
      'foaf:name': 'Alice'
    }));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    const result = await persister.getPersona();
    expect(result?.id).toBe(PERSONA_ID);
    expect(result?.row.name).toBe('Alice');
  });

  it('listContacts returns [] when container is missing', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(404));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await expect(persister.listContacts()).resolves.toEqual([]);
  });

  it('listContacts fetches member URLs from ldp:contains and parses contacts', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(200))
      .mockResolvedValueOnce(jsonResponse({
        'ldp:contains': [
          { '@id': 'https://alice.example/devalbo/contacts/c1.jsonld' },
          { '@id': 'https://alice.example/devalbo/contacts/c2.jsonld' }
        ]
      }))
      .mockResolvedValueOnce(jsonResponse({
        '@id': 'contact_1',
        'vcard:fn': 'Bob',
        'vcard:hasUID': 'urn:uuid:bob'
      }))
      .mockResolvedValueOnce(jsonResponse({
        '@id': 'contact_2',
        'vcard:fn': 'Carol',
        'vcard:hasUID': 'urn:uuid:carol'
      }));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    const contacts = await persister.listContacts();
    expect(contacts).toHaveLength(2);
    expect(contacts.map((entry) => entry.row.name)).toEqual(['Bob', 'Carol']);
  });

  it('listContacts follows rel=next pagination links', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(200))
      .mockResolvedValueOnce(jsonResponse(
        { 'ldp:contains': [{ '@id': 'https://alice.example/devalbo/contacts/c1.jsonld' }] },
        200,
        {
          'Content-Type': 'application/ld+json',
          Link: '<https://alice.example/devalbo/contacts/?page=2>; rel="next"'
        }
      ))
      .mockResolvedValueOnce(jsonResponse({
        'ldp:contains': [{ '@id': 'https://alice.example/devalbo/contacts/c2.jsonld' }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        '@id': 'contact_1',
        'vcard:fn': 'Bob',
        'vcard:hasUID': 'urn:uuid:bob'
      }))
      .mockResolvedValueOnce(jsonResponse({
        '@id': 'contact_2',
        'vcard:fn': 'Carol',
        'vcard:hasUID': 'urn:uuid:carol'
      }));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    const contacts = await persister.listContacts();
    expect(contacts).toHaveLength(2);
  });

  it('ensureContainer with existing container does not POST', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(200));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await persister.ensureContainer('contacts');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('https://alice.example/devalbo/contacts/', { method: 'HEAD' });
  });

  it('ensureContainer creates app and nested containers when missing', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(404))
      .mockResolvedValueOnce(emptyResponse(404))
      .mockResolvedValueOnce(emptyResponse(201))
      .mockResolvedValueOnce(emptyResponse(201));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await persister.ensureContainer('contacts');
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(fetchFn.mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchFn.mock.calls[3]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('putPersona writes persona resource using PUT', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(emptyResponse(201));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    await persister.putPersona({
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
    }, PERSONA_ID);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://alice.example/devalbo/persona.jsonld',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('putGroupJsonLd writes group resource using PUT', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyResponse(200))
      .mockResolvedValueOnce(emptyResponse(201));
    const persister = new SolidLdpPersister(POD_ROOT, POD_NAMESPACE, fetchFn);
    const payload = { '@id': 'group_1', 'vcard:fn': 'Group One' };
    await persister.putGroupJsonLd('group_1', payload);
    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://alice.example/devalbo/groups/group_1.jsonld');
    const put = fetchFn.mock.calls[1]?.[1] as RequestInit;
    expect(put.method).toBe('PUT');
    expect(put.body).toBe(JSON.stringify(payload, null, 2));
  });
});
