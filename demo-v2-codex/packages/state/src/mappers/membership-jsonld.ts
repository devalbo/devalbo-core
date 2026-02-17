import { ORG, type MembershipRow } from '@devalbo/shared';

type JsonLdObject = Record<string, unknown>;

const nonEmpty = (value: string): boolean => value.trim().length > 0;

export const membershipToJsonLd = (row: MembershipRow): JsonLdObject => {
  const hasInterval = nonEmpty(row.startDate) || nonEmpty(row.endDate);

  return {
    '@type': 'org:Membership',
    'org:member': { '@id': row.contactId },
    ...(nonEmpty(row.role) ? { 'org:role': { '@id': row.role } } : {}),
    ...(hasInterval
      ? {
          'org:memberDuring': {
            '@type': 'time:Interval',
            ...(nonEmpty(row.startDate) ? { 'time:hasBeginning': row.startDate } : {}),
            ...(nonEmpty(row.endDate) ? { 'time:hasEnd': row.endDate } : {})
          }
        }
      : {})
  };
};

export const extractRoleFromMembershipJsonLd = (membership: JsonLdObject): string => {
  const roleValue = membership['org:role'] ?? membership[ORG.role];
  if (typeof roleValue === 'string') return roleValue;
  if (
    typeof roleValue === 'object' &&
    roleValue &&
    '@id' in roleValue &&
    typeof (roleValue as { '@id'?: unknown })['@id'] === 'string'
  ) {
    return (roleValue as { '@id': string })['@id'];
  }
  return '';
};
