import { z } from 'zod';
import {
  parseContactId,
  parseGroupId,
  parseMembershipId,
  parsePersonaId,
  unsafeAsContactId,
  unsafeAsGroupId,
  unsafeAsMembershipId,
  unsafeAsPersonaId,
  type ContactId,
  type GroupId,
  type MembershipId,
  type PersonaId
} from '@devalbo/shared';

const PersonaIdSchema = z.string()
  .refine((value) => parsePersonaId(value).success, 'Invalid persona id')
  .transform((value) => unsafeAsPersonaId(value));
const ContactIdSchema = z.string()
  .refine((value) => parseContactId(value).success, 'Invalid contact id')
  .transform((value) => unsafeAsContactId(value));
const GroupIdSchema = z.string()
  .refine((value) => parseGroupId(value).success, 'Invalid group id')
  .transform((value) => unsafeAsGroupId(value));
const MembershipIdSchema = z.string()
  .refine((value) => parseMembershipId(value).success, 'Invalid membership id')
  .transform((value) => unsafeAsMembershipId(value));

export const PersonaCreateArgsSchema = z.object({
  name: z.string().trim().min(1),
  nickname: z.string().optional(),
  email: z.string().optional(),
  bio: z.string().optional(),
  homepage: z.string().optional(),
  image: z.string().optional()
});

export const PersonaIdArgsSchema = z.object({
  id: PersonaIdSchema
});

export const PersonaShowArgsSchema = PersonaIdArgsSchema.extend({
  json: z.boolean().default(false)
});

export const PersonaEditArgsSchema = z.object({
  id: PersonaIdSchema,
  updates: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one --field=value update is required'
  })
});

export const ContactListArgsSchema = z.object({
  agents: z.boolean().default(false),
  people: z.boolean().default(false)
});

export const ContactAddArgsSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  org: z.string().optional(),
  agent: z.boolean().default(false),
  category: z.string().optional()
});

export const ContactIdArgsSchema = z.object({
  id: ContactIdSchema
});

export const ContactShowArgsSchema = ContactIdArgsSchema.extend({
  json: z.boolean().default(false)
});

export const ContactEditArgsSchema = z.object({
  id: ContactIdSchema,
  updates: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one --field=value update is required'
  })
});

export const ContactSearchArgsSchema = z.object({
  query: z.string().trim().min(1)
});

export const ContactLinkArgsSchema = z.object({
  contactId: ContactIdSchema,
  personaId: PersonaIdSchema
});

export const GroupListArgsSchema = z.object({
  type: z.enum(['organization', 'team', 'group']).optional()
});

export const GroupCreateArgsSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['organization', 'team', 'group']).optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  logo: z.string().optional(),
  parent: z.string().optional()
});

export const GroupIdArgsSchema = z.object({
  id: GroupIdSchema
});

export const GroupShowArgsSchema = GroupIdArgsSchema.extend({
  json: z.boolean().default(false)
});

export const GroupEditArgsSchema = z.object({
  id: GroupIdSchema,
  updates: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one --field=value update is required'
  })
});

export const GroupAddMemberArgsSchema = z.object({
  groupId: GroupIdSchema,
  contactId: ContactIdSchema,
  role: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

export const GroupRemoveMemberArgsSchema = z.object({
  groupId: GroupIdSchema,
  contactId: ContactIdSchema
});

export const GroupListMembersArgsSchema = z.object({
  groupId: GroupIdSchema
});

export const MembershipIdArgsSchema = z.object({
  id: MembershipIdSchema
});

export type PersonaCreateArgs = z.infer<typeof PersonaCreateArgsSchema>;
export type PersonaShowArgs = z.infer<typeof PersonaShowArgsSchema>;
export type PersonaEditArgs = z.infer<typeof PersonaEditArgsSchema>;
export type PersonaIdArgs = z.infer<typeof PersonaIdArgsSchema>;

export type ContactListArgs = z.infer<typeof ContactListArgsSchema>;
export type ContactAddArgs = z.infer<typeof ContactAddArgsSchema>;
export type ContactShowArgs = z.infer<typeof ContactShowArgsSchema>;
export type ContactEditArgs = z.infer<typeof ContactEditArgsSchema>;
export type ContactIdArgs = z.infer<typeof ContactIdArgsSchema>;
export type ContactSearchArgs = z.infer<typeof ContactSearchArgsSchema>;
export type ContactLinkArgs = z.infer<typeof ContactLinkArgsSchema>;

export type GroupListArgs = z.infer<typeof GroupListArgsSchema>;
export type GroupCreateArgs = z.infer<typeof GroupCreateArgsSchema>;
export type GroupShowArgs = z.infer<typeof GroupShowArgsSchema>;
export type GroupEditArgs = z.infer<typeof GroupEditArgsSchema>;
export type GroupIdArgs = z.infer<typeof GroupIdArgsSchema>;
export type GroupAddMemberArgs = z.infer<typeof GroupAddMemberArgsSchema>;
export type GroupRemoveMemberArgs = z.infer<typeof GroupRemoveMemberArgsSchema>;
export type GroupListMembersArgs = z.infer<typeof GroupListMembersArgsSchema>;

export type SocialId = PersonaId | ContactId | GroupId | MembershipId;
