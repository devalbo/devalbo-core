import {
  DCTERMS,
  FOAF,
  LDP,
  POD_CONTEXT,
  SOLID,
  VCARD,
  type PersonaId,
  type PersonaRow,
  type PersonaRowInput
} from '@devalbo/shared';

type JsonLdObject = Record<string, unknown>;

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const field = (key: string, value: string): JsonLdObject => (nonEmpty(value) ? { [key]: value } : {});

const nodeRefField = (key: string, value: string): JsonLdObject =>
  nonEmpty(value) ? { [key]: { '@id': value } } : {};

const valueAsString = (value: unknown): string => (typeof value === 'string' ? value : '');

const parseMultiCell = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) return nonEmpty(trimmed) ? [trimmed] : [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return nonEmpty(trimmed) ? [trimmed] : [];
    return parsed.filter((item): item is string => typeof item === 'string' && nonEmpty(item));
  } catch {
    return nonEmpty(trimmed) ? [trimmed] : [];
  }
};

const parseJsonLdMultiField = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseJsonLdMultiField(entry));
  }
  const scalar = valueAsNodeId(value).trim();
  return scalar ? [scalar] : [];
};

const toStoreMultiCell = (values: string[]): string => {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0] ?? '';
  return JSON.stringify(values);
};

const valueAsNodeId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && '@id' in value && typeof (value as { '@id'?: unknown })['@id'] === 'string') {
    return (value as { '@id': string })['@id'];
  }
  return '';
};

const get = (obj: JsonLdObject, prefixed: string, fullIri: string): unknown => obj[prefixed] ?? obj[fullIri];

export const personaToJsonLd = (row: PersonaRow, id: PersonaId): JsonLdObject => {
  const emails = parseMultiCell(row.email);
  const phones = parseMultiCell(row.phone);

  return {
    '@context': POD_CONTEXT,
    '@type': 'foaf:Person',
    '@id': id,
    'foaf:name': row.name,
    ...field('foaf:nick', row.nickname),
    ...field('foaf:givenName', row.givenName),
    ...field('foaf:familyName', row.familyName),
    ...(emails.length > 0
      ? { 'vcard:hasEmail': emails.length === 1 ? emails[0] : emails }
      : {}),
    ...(phones.length > 0
      ? { 'vcard:hasTelephone': phones.length === 1 ? phones[0] : phones }
      : {}),
    ...field('foaf:img', row.image),
    ...field('vcard:note', row.bio),
    ...field('foaf:homepage', row.homepage),
    ...field('solid:oidcIssuer', row.oidcIssuer),
    ...field('ldp:inbox', row.inbox),
    ...field('solid:publicTypeIndex', row.publicTypeIndex),
    ...field('solid:privateTypeIndex', row.privateTypeIndex),
    ...field('pim:preferencesFile', row.preferencesFile),
    ...nodeRefField('foaf:isPrimaryTopicOf', row.profileDoc),
    ...field('dc:modified', row.updatedAt)
  };
};

export const jsonLdToPersonaRow = (jsonLd: JsonLdObject): { id: PersonaId; row: PersonaRowInput } => ({
  id: valueAsString(jsonLd['@id']) as PersonaId,
  row: {
    name: valueAsString(get(jsonLd, 'foaf:name', FOAF.name)),
    nickname: valueAsString(get(jsonLd, 'foaf:nick', FOAF.nick)),
    givenName: valueAsString(get(jsonLd, 'foaf:givenName', FOAF.givenName)),
    familyName: valueAsString(get(jsonLd, 'foaf:familyName', FOAF.familyName)),
    email: toStoreMultiCell(parseJsonLdMultiField(get(jsonLd, 'vcard:hasEmail', VCARD.hasEmail))),
    phone: toStoreMultiCell(parseJsonLdMultiField(get(jsonLd, 'vcard:hasTelephone', VCARD.hasTelephone))),
    image: valueAsString(get(jsonLd, 'foaf:img', FOAF.img)),
    bio: valueAsString(get(jsonLd, 'vcard:note', VCARD.note)),
    homepage: valueAsString(get(jsonLd, 'foaf:homepage', FOAF.homepage)),
    oidcIssuer: valueAsString(get(jsonLd, 'solid:oidcIssuer', SOLID.oidcIssuer)),
    inbox: valueAsString(get(jsonLd, 'ldp:inbox', LDP.inbox)),
    publicTypeIndex: valueAsString(get(jsonLd, 'solid:publicTypeIndex', SOLID.publicTypeIndex)),
    privateTypeIndex: valueAsString(get(jsonLd, 'solid:privateTypeIndex', SOLID.privateTypeIndex)),
    preferencesFile: valueAsString(get(jsonLd, 'pim:preferencesFile', 'http://www.w3.org/ns/pim/space#preferencesFile')),
    profileDoc: valueAsNodeId(get(jsonLd, 'foaf:isPrimaryTopicOf', FOAF.isPrimaryTopicOf)),
    isDefault: false,
    updatedAt: valueAsString(get(jsonLd, 'dc:modified', DCTERMS.modified))
  }
});
