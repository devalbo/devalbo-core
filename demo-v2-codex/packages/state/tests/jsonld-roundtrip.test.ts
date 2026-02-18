import { describe, expect, it } from 'vitest';
import { unsafeAsContactId, unsafeAsGroupId, unsafeAsPersonaId } from '@devalbo/shared';
import { createDevalboStore } from '../src/store';
import {
  addMember,
  contactToJsonLd,
  extractMembershipsFromGroupJsonLd,
  groupToJsonLd,
  jsonLdToContactRow,
  jsonLdToGroupRow,
  jsonLdToPersonaRow,
  personaToJsonLd,
  setContact,
  setGroup,
  setPersona
} from '../src';
import { TbContactSchema, TbGroupSchema, TbPersonaSchema } from './helpers/tb-solid-pod-schemas';

describe('jsonld roundtrip', () => {
  it('roundtrips persona row through JSON-LD', () => {
    const personaId = unsafeAsPersonaId('persona-1');
    const original = {
      name: 'Alice',
      nickname: 'ali',
      givenName: 'Alice',
      familyName: 'Example',
      email: 'mailto:alice@example.com',
      phone: 'tel:+15550001',
      image: 'https://example.com/alice.png',
      bio: 'bio',
      homepage: 'https://example.com',
      oidcIssuer: 'https://issuer.example.com',
      inbox: 'https://example.com/inbox',
      publicTypeIndex: 'https://example.com/public.ttl',
      privateTypeIndex: 'https://example.com/private.ttl',
      preferencesFile: 'https://example.com/prefs.ttl',
      profileDoc: 'https://example.com/profile/card',
      isDefault: false,
      updatedAt: '2026-02-16T00:00:00.000Z'
    } as const;

    const jsonLd = personaToJsonLd(original, personaId);
    expect(() => TbPersonaSchema.parse(jsonLd)).not.toThrow();

    const roundtripped = jsonLdToPersonaRow(jsonLd);
    expect(roundtripped.id).toBe(personaId);
    expect(roundtripped.row.name).toBe(original.name);
    expect(roundtripped.row.email).toBe(original.email);
    expect(roundtripped.row.phone).toBe(original.phone);
  });

  it('supports multi-value email/phone roundtrip as array-backed cells', () => {
    const personaId = unsafeAsPersonaId('persona-multi');
    const multiEmail = JSON.stringify(['mailto:one@example.com', 'mailto:two@example.com']);
    const multiPhone = JSON.stringify(['tel:+15550003', 'tel:+15550004']);

    const jsonLd = personaToJsonLd({
      name: 'Multi',
      nickname: '',
      givenName: '',
      familyName: '',
      email: multiEmail,
      phone: multiPhone,
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
      updatedAt: '2026-02-16T00:00:00.000Z'
    }, personaId);

    expect(Array.isArray(jsonLd['vcard:hasEmail'])).toBe(true);
    expect(Array.isArray(jsonLd['vcard:hasTelephone'])).toBe(true);

    const roundtripped = jsonLdToPersonaRow(jsonLd);
    expect(roundtripped.row.email).toBe(multiEmail);
    expect(roundtripped.row.phone).toBe(multiPhone);
  });

  it('roundtrips contact row through JSON-LD', () => {
    const contactId = unsafeAsContactId('contact-1');
    const original = {
      name: 'Bob',
      uid: 'urn:uuid:1234',
      nickname: 'b',
      kind: 'agent' as const,
      email: 'mailto:bob@example.com',
      phone: 'tel:+15550002',
      url: 'https://example.com/bob',
      photo: 'https://example.com/bob.png',
      notes: 'note',
      organization: 'Acme',
      role: 'Engineer',
      webId: 'https://example.com/profile#bob',
      agentCategory: 'automation',
      linkedPersona: 'persona-1',
      updatedAt: '2026-02-16T00:00:00.000Z'
    };

    const jsonLd = contactToJsonLd(original, contactId);
    expect(() => TbContactSchema.parse(jsonLd)).not.toThrow();

    const roundtripped = jsonLdToContactRow(jsonLd);
    expect(roundtripped.id).toBe(contactId);
    expect(roundtripped.row.kind).toBe('agent');
    expect(roundtripped.row.agentCategory).toBe('automation');
    expect(roundtripped.row.linkedPersona).toBe('persona-1');
  });

  it('roundtrips group row and memberships through JSON-LD', () => {
    const store = createDevalboStore();
    const groupId = unsafeAsGroupId('group-1');
    const contactId = unsafeAsContactId('contact-1');

    setGroup(store, groupId, {
      name: 'Core Team',
      groupType: 'team',
      description: 'desc',
      url: '',
      logo: '',
      parentGroup: '',
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    setContact(store, contactId, {
      name: 'Bob',
      uid: 'urn:uuid:1234',
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
      updatedAt: '2026-02-16T00:00:00.000Z'
    });
    addMember(store, {
      groupId,
      contactId,
      role: 'http://www.w3.org/ns/org#Role',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: ''
    });

    const groupJson = groupToJsonLd(store, {
      name: 'Core Team',
      groupType: 'team',
      description: 'desc',
      url: '',
      logo: '',
      parentGroup: '',
      updatedAt: '2026-02-16T00:00:00.000Z'
    }, groupId);
    expect(() => TbGroupSchema.parse(groupJson)).not.toThrow();

    const roundtrippedGroup = jsonLdToGroupRow(groupJson);
    const roundtrippedMemberships = extractMembershipsFromGroupJsonLd(groupJson);
    expect(roundtrippedGroup.id).toBe(groupId);
    expect(roundtrippedGroup.row.groupType).toBe('team');
    expect(roundtrippedMemberships).toHaveLength(1);
    expect(roundtrippedMemberships[0]?.contactId).toBe(contactId);
  });

  it('maps team/group hierarchy with parentGroup node refs', () => {
    const groupJson = {
      '@context': { test: true },
      '@type': 'org:OrganizationalUnit',
      '@id': 'group-team-1',
      'vcard:fn': 'Platform Team',
      'org:unitOf': { '@id': 'group-org-1' },
      'dc:modified': '2026-02-16T00:00:00.000Z'
    };

    const parsed = jsonLdToGroupRow(groupJson);
    expect(parsed.row.groupType).toBe('team');
    expect(parsed.row.parentGroup).toBe('group-org-1');
  });

  it('parses solid:oidcIssuer from both node refs and string literals', () => {
    const fromNode = jsonLdToPersonaRow({
      '@id': 'persona_node',
      'foaf:name': 'Alice',
      'solid:oidcIssuer': { '@id': 'https://issuer.example.org' }
    });
    expect(fromNode.row.oidcIssuer).toBe('https://issuer.example.org');

    const fromString = jsonLdToPersonaRow({
      '@id': 'persona_string',
      'foaf:name': 'Alice',
      'solid:oidcIssuer': 'https://issuer.example.org'
    });
    expect(fromString.row.oidcIssuer).toBe('https://issuer.example.org');
  });
});
