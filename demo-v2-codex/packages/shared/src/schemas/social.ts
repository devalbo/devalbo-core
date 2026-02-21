import { z } from 'zod';

const optionalStringCell = z.string().default('');

export const GroupTypeSchema = z.enum(['organization', 'team', 'group']);
export const ContactKindSchema = z.enum(['person', 'agent']);

export const PersonaRowSchema = z.object({
  name: z.string().min(1),
  nickname: optionalStringCell,
  givenName: optionalStringCell,
  familyName: optionalStringCell,
  email: optionalStringCell,
  phone: optionalStringCell,
  image: optionalStringCell,
  bio: optionalStringCell,
  homepage: optionalStringCell,
  oidcIssuer: optionalStringCell,
  inbox: optionalStringCell,
  publicTypeIndex: optionalStringCell,
  privateTypeIndex: optionalStringCell,
  preferencesFile: optionalStringCell,
  storage: optionalStringCell,
  profileDoc: optionalStringCell,
  isDefault: z.boolean(),
  updatedAt: z.string()
});

export const ContactRowSchema = z.object({
  name: z.string().min(1),
  uid: z.string().min(1),
  nickname: optionalStringCell,
  kind: ContactKindSchema,
  email: optionalStringCell,
  phone: optionalStringCell,
  url: optionalStringCell,
  photo: optionalStringCell,
  notes: optionalStringCell,
  organization: optionalStringCell,
  role: optionalStringCell,
  webId: optionalStringCell,
  agentCategory: optionalStringCell,
  linkedPersona: optionalStringCell,
  updatedAt: z.string()
});

export const GroupRowSchema = z.object({
  name: z.string().min(1),
  groupType: GroupTypeSchema,
  description: optionalStringCell,
  url: optionalStringCell,
  logo: optionalStringCell,
  parentGroup: optionalStringCell,
  updatedAt: z.string()
});

export const MembershipRowSchema = z.object({
  groupId: z.string().min(1),
  contactId: z.string().min(1),
  role: optionalStringCell,
  startDate: optionalStringCell,
  endDate: optionalStringCell
});

export const ActivitySubjectTypeSchema = z.enum(['contact', 'group']);
export const ActivityTypeSchema = z.enum(['share-card', 'share-file', 'share-link', 'invite', 'note']);

export const ActivityRowSchema = z.object({
  actorPersonaId: z.string().min(1),
  subjectType: ActivitySubjectTypeSchema,
  subjectId: z.string().min(1),
  activityType: ActivityTypeSchema,
  payload: z.string(),
  timestamp: z.string()
});

// Schematizer-friendly schemas (enum cells must be relaxed to string).
export const PersonaRowStoreSchema = PersonaRowSchema;
export const ContactRowStoreSchema = ContactRowSchema.extend({
  kind: z.string()
});
export const GroupRowStoreSchema = GroupRowSchema.extend({
  groupType: z.string()
});
export const MembershipRowStoreSchema = MembershipRowSchema;
export const ActivityRowStoreSchema = ActivityRowSchema.extend({
  subjectType: z.string(),
  activityType: z.string()
});
