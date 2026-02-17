import { z } from 'zod';

// Adapted from tb-solid-pod schema conventions for interop checks.
// Baseline copied on 2026-02-16 for local validation-only tests.

const NodeRefSchema = z.object({
  '@id': z.string().min(1)
});

const OneOrMany = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.array(schema)]);

export const TbPersonaSchema = z.object({
  '@context': z.unknown(),
  '@type': z.union([z.literal('foaf:Person'), z.string().url()]),
  '@id': z.string().min(1),
  'foaf:name': z.string().min(1),
  'vcard:hasEmail': OneOrMany(z.string()).optional(),
  'vcard:hasTelephone': OneOrMany(z.string()).optional(),
  'foaf:isPrimaryTopicOf': NodeRefSchema.optional()
});

export const TbContactSchema = z.object({
  '@context': z.unknown(),
  '@type': z.union([z.literal('vcard:Individual'), z.string().url()]),
  '@id': z.string().min(1),
  'vcard:fn': z.string().min(1),
  'vcard:hasUID': z.string().min(1)
});

export const TbMembershipSchema = z.object({
  '@type': z.union([z.literal('org:Membership'), z.string().url()]),
  'org:member': NodeRefSchema
});

export const TbGroupSchema = z.object({
  '@context': z.unknown(),
  '@type': z.union([
    z.literal('org:Organization'),
    z.literal('org:OrganizationalUnit'),
    z.literal('vcard:Group'),
    z.string().url()
  ]),
  '@id': z.string().min(1),
  'vcard:fn': z.string().min(1),
  'vcard:hasMember': z.array(NodeRefSchema).optional(),
  'org:hasMembership': z.array(TbMembershipSchema).optional()
});
