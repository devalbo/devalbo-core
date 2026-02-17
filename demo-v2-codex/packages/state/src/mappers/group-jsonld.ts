import {
  DCTERMS,
  ORG,
  POD_CONTEXT,
  VCARD,
  type ContactId,
  type GroupId,
  type GroupRow,
  type GroupRowInput,
  type MembershipRowInput
} from '@devalbo/shared';
import type { Store } from 'tinybase';
import { listMembers } from '../accessors/memberships';
import { membershipToJsonLd, extractRoleFromMembershipJsonLd } from './membership-jsonld';

type JsonLdObject = Record<string, unknown>;

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const field = (key: string, value: string): JsonLdObject => (nonEmpty(value) ? { [key]: value } : {});

const nodeRefField = (key: string, value: string): JsonLdObject =>
  nonEmpty(value) ? { [key]: { '@id': value } } : {};

const valueAsString = (value: unknown): string => (typeof value === 'string' ? value : '');

const valueAsNodeId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && '@id' in value && typeof (value as { '@id'?: unknown })['@id'] === 'string') {
    return (value as { '@id': string })['@id'];
  }
  return '';
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);

const get = (obj: JsonLdObject, prefixed: string, fullIri: string): unknown => obj[prefixed] ?? obj[fullIri];

const groupTypeToJsonLdType = (groupType: GroupRow['groupType']): string => {
  switch (groupType) {
    case 'organization':
      return 'org:Organization';
    case 'team':
      return 'org:OrganizationalUnit';
    default:
      return 'vcard:Group';
  }
};

const jsonLdTypeToGroupType = (typeValue: unknown): GroupRow['groupType'] => {
  const typeList = asArray(typeValue).map((item) => valueAsString(item));
  if (typeList.some((entry) => entry === 'org:Organization' || entry === ORG.Organization)) return 'organization';
  if (typeList.some((entry) => entry === 'org:OrganizationalUnit' || entry === ORG.OrganizationalUnit)) return 'team';
  return 'group';
};

export const groupToJsonLd = (store: Store, row: GroupRow, id: GroupId): JsonLdObject => {
  const memberships = listMembers(store, id).map(({ row: membership }) => membership);
  const members = memberships.map((membership) => ({ '@id': membership.contactId }));
  const expandedMemberships = memberships.map((membership) => membershipToJsonLd(membership));

  return {
    '@context': POD_CONTEXT,
    '@type': groupTypeToJsonLdType(row.groupType),
    '@id': id,
    'vcard:fn': row.name,
    ...field('dc:description', row.description),
    ...field('vcard:hasURL', row.url),
    ...field('vcard:hasLogo', row.logo),
    ...nodeRefField('org:unitOf', row.parentGroup),
    ...field('dc:modified', row.updatedAt),
    ...(members.length > 0 ? { 'vcard:hasMember': members } : {}),
    ...(expandedMemberships.length > 0 ? { 'org:hasMembership': expandedMemberships } : {})
  };
};

export const jsonLdToGroupRow = (jsonLd: JsonLdObject): { id: GroupId; row: GroupRowInput } => ({
  id: valueAsString(jsonLd['@id']) as GroupId,
  row: {
    name: valueAsString(get(jsonLd, 'vcard:fn', VCARD.fn)),
    groupType: jsonLdTypeToGroupType(jsonLd['@type']),
    description: valueAsString(get(jsonLd, 'dc:description', DCTERMS.description)),
    url: valueAsString(get(jsonLd, 'vcard:hasURL', VCARD.hasURL)),
    logo: valueAsString(get(jsonLd, 'vcard:hasLogo', VCARD.hasLogo)),
    parentGroup: valueAsNodeId(get(jsonLd, 'org:unitOf', ORG.unitOf)),
    updatedAt: valueAsString(get(jsonLd, 'dc:modified', DCTERMS.modified))
  }
});

export const extractMembershipsFromGroupJsonLd = (
  jsonLd: JsonLdObject
): Array<Omit<MembershipRowInput, 'groupId' | 'contactId'> & { groupId: GroupId; contactId: ContactId }> => {
  const groupId = valueAsString(jsonLd['@id']) as GroupId;
  const membershipObjects = asArray(get(jsonLd, 'org:hasMembership', ORG.hasMembership));

  const expanded = membershipObjects.flatMap((value) => {
    if (typeof value !== 'object' || !value) return [];
    const membership = value as JsonLdObject;
    const member = get(membership, 'org:member', ORG.member);
    const contactId = valueAsNodeId(member) as ContactId;
    if (!nonEmpty(contactId)) return [];

    const during = get(membership, 'org:memberDuring', ORG.memberDuring);
    const duringObject = typeof during === 'object' && during ? (during as JsonLdObject) : {};

    return [{
      groupId,
      contactId,
      role: extractRoleFromMembershipJsonLd(membership),
      startDate: valueAsString(duringObject['time:hasBeginning'] ?? duringObject['http://www.w3.org/2006/time#hasBeginning']),
      endDate: valueAsString(duringObject['time:hasEnd'] ?? duringObject['http://www.w3.org/2006/time#hasEnd'])
    }];
  });

  if (expanded.length > 0) return expanded;

  const directMembers = asArray(get(jsonLd, 'vcard:hasMember', VCARD.hasMember));
  return directMembers.flatMap((value) => {
    const contactId = valueAsNodeId(value) as ContactId;
    if (!nonEmpty(contactId)) return [];
    return [{
      groupId,
      contactId,
      role: '',
      startDate: '',
      endDate: ''
    }];
  });
};
