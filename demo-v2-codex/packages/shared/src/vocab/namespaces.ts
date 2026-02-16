import { FOAF, VCARD, LDP, DCTERMS } from '@inrupt/vocab-common-rdf';
import { SOLID, WS } from '@inrupt/vocab-solid-common';

export { FOAF, VCARD, LDP, DCTERMS, SOLID, WS };

export const ORG = {
  NAMESPACE: 'http://www.w3.org/ns/org#',
  Organization: 'http://www.w3.org/ns/org#Organization',
  OrganizationalUnit: 'http://www.w3.org/ns/org#OrganizationalUnit',
  Membership: 'http://www.w3.org/ns/org#Membership',
  Role: 'http://www.w3.org/ns/org#Role',
  member: 'http://www.w3.org/ns/org#member',
  hasMember: 'http://www.w3.org/ns/org#hasMember',
  hasMembership: 'http://www.w3.org/ns/org#hasMembership',
  memberOf: 'http://www.w3.org/ns/org#memberOf',
  hasUnit: 'http://www.w3.org/ns/org#hasUnit',
  unitOf: 'http://www.w3.org/ns/org#unitOf',
  role: 'http://www.w3.org/ns/org#role',
  memberDuring: 'http://www.w3.org/ns/org#memberDuring'
} as const;

export const TIME = {
  NAMESPACE: 'http://www.w3.org/2006/time#',
  Interval: 'http://www.w3.org/2006/time#Interval',
  hasBeginning: 'http://www.w3.org/2006/time#hasBeginning',
  hasEnd: 'http://www.w3.org/2006/time#hasEnd'
} as const;

export const NS = {
  foaf: 'http://xmlns.com/foaf/0.1/',
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  solid: 'http://www.w3.org/ns/solid/terms#',
  org: 'http://www.w3.org/ns/org#',
  ldp: 'http://www.w3.org/ns/ldp#',
  acl: 'http://www.w3.org/ns/auth/acl#',
  dc: 'http://purl.org/dc/terms/',
  posix: 'http://www.w3.org/ns/posix/stat#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  schema: 'https://schema.org/',
  cert: 'http://www.w3.org/ns/auth/cert#',
  time: 'http://www.w3.org/2006/time#'
} as const;

export const POD_CONTEXT = {
  '@vocab': NS.vcard,
  foaf: NS.foaf,
  solid: NS.solid,
  vcard: NS.vcard,
  org: NS.org,
  ldp: NS.ldp,
  acl: NS.acl,
  dc: NS.dc,
  posix: NS.posix,
  xsd: NS.xsd,
  schema: NS.schema,
  cert: NS.cert
} as const;
