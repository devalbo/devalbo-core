import {
  DCTERMS,
  FOAF,
  POD_CONTEXT,
  SOLID,
  VCARD,
  type ContactId,
  type ContactKind,
  type ContactRow,
  type ContactRowInput
} from '@devalbo/shared';

type JsonLdObject = Record<string, unknown>;

const SCHEMA_APPLICATION_CATEGORY = 'https://schema.org/applicationCategory';

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

export const contactToJsonLd = (row: ContactRow, id: ContactId): JsonLdObject => {
  const emails = parseMultiCell(row.email);
  const phones = parseMultiCell(row.phone);

  return {
    '@context': POD_CONTEXT,
    '@type': 'vcard:Individual',
    '@id': id,
    'vcard:fn': row.name,
    'vcard:hasUID': row.uid,
    ...field('vcard:nickname', row.nickname),
    ...(emails.length > 0
      ? { 'vcard:hasEmail': emails.length === 1 ? emails[0] : emails }
      : {}),
    ...(phones.length > 0
      ? { 'vcard:hasTelephone': phones.length === 1 ? phones[0] : phones }
      : {}),
    ...field('vcard:hasURL', row.url),
    ...field('vcard:hasPhoto', row.photo),
    ...field('vcard:hasNote', row.notes),
    ...field('vcard:hasOrganizationName', row.organization),
    ...field('vcard:hasRole', row.role),
    ...nodeRefField('solid:webid', row.webId),
    ...field('schema:applicationCategory', row.agentCategory),
    ...nodeRefField('vcard:hasRelated', row.linkedPersona),
    ...field('dc:modified', row.updatedAt)
  };
};

const inferKind = (agentCategory: string): ContactKind => (nonEmpty(agentCategory) ? 'agent' : 'person');

const isValidUrl = (s: string): boolean => { try { new URL(s); return true; } catch { return false; } };

export const jsonLdToContactRow = (jsonLd: JsonLdObject): { id: ContactId; row: ContactRowInput } => {
  const agentCategory = valueAsString(get(jsonLd, 'schema:applicationCategory', SCHEMA_APPLICATION_CATEGORY));
  const rawId = valueAsString(jsonLd['@id']);

  return {
    id: rawId as ContactId,
    row: {
      // foaf:name fallback handles persona cards (foaf:Person) pasted into the importer
      name: valueAsString(get(jsonLd, 'vcard:fn', VCARD.fn)) || valueAsString(get(jsonLd, 'foaf:name', FOAF.name)),
      uid: valueAsString(get(jsonLd, 'vcard:hasUID', VCARD.hasUID)),
      nickname: valueAsString(get(jsonLd, 'vcard:nickname', VCARD.nickname)) || valueAsString(get(jsonLd, 'foaf:nick', FOAF.nick)),
      kind: inferKind(agentCategory),
      email: toStoreMultiCell(parseJsonLdMultiField(get(jsonLd, 'vcard:hasEmail', VCARD.hasEmail))),
      phone: toStoreMultiCell(parseJsonLdMultiField(get(jsonLd, 'vcard:hasTelephone', VCARD.hasTelephone))),
      // foaf:homepage fallback: persona cards use foaf:homepage (as node ref) instead of vcard:hasURL
      url: valueAsString(get(jsonLd, 'vcard:hasURL', VCARD.hasURL)) || valueAsNodeId(get(jsonLd, 'foaf:homepage', FOAF.homepage)),
      // foaf:img fallback: persona cards use foaf:img instead of vcard:hasPhoto
      photo: valueAsString(get(jsonLd, 'vcard:hasPhoto', VCARD.hasPhoto)) || valueAsString(get(jsonLd, 'foaf:img', FOAF.img)),
      // vcard:note fallback: persona cards use vcard:note (bio) instead of vcard:hasNote
      notes: valueAsString(get(jsonLd, 'vcard:hasNote', VCARD.hasNote)) || valueAsString(get(jsonLd, 'vcard:note', VCARD.note)),
      organization: valueAsString(get(jsonLd, 'vcard:hasOrganizationName', VCARD.hasOrganizationName)),
      role: valueAsString(get(jsonLd, 'vcard:hasRole', VCARD.hasRole)),
      // URL-shaped @id fallback: persona cards use @id as their WebID
      webId: valueAsNodeId(get(jsonLd, 'solid:webid', SOLID.webid)) || (isValidUrl(rawId) ? rawId : ''),
      agentCategory,
      linkedPersona: valueAsNodeId(get(jsonLd, 'vcard:hasRelated', VCARD.hasRelated)),
      updatedAt: valueAsString(get(jsonLd, 'dc:modified', DCTERMS.modified))
    }
  };
};
