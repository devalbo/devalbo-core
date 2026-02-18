import { z } from 'zod';
import {
  createBrandedUuidToolbox,
  IdTypePrefixBrandSchema,
  type Branded
} from '@devalbo/branded-types';

export type { Branded };

export type FilePath = Branded<string, 'FilePath'>;
export type DirectoryPath = Branded<string, 'DirectoryPath'>;
export type PersonaId = Branded<string, 'PersonaId'>;
export type ContactId = Branded<string, 'ContactId'>;
export type GroupId = Branded<string, 'GroupId'>;
export type MembershipId = Branded<string, 'MembershipId'>;
export type ActivityId = Branded<string, 'ActivityId'>;

export const FilePathSchema = z.string().trim().min(1, 'path is required').transform((path) => path as FilePath);
export const DirectoryPathSchema = z
  .string()
  .trim()
  .min(1, 'path is required')
  .transform((path) => path as DirectoryPath);

export const parseFilePath = (path: string): z.ZodSafeParseResult<FilePath> => FilePathSchema.safeParse(path);
export const parseDirectoryPath = (path: string): z.ZodSafeParseResult<DirectoryPath> =>
  DirectoryPathSchema.safeParse(path);

export const assertFilePath = (path: string): FilePath => FilePathSchema.parse(path);
export const assertDirectoryPath = (path: string): DirectoryPath => DirectoryPathSchema.parse(path);

export const unsafeAsFilePath = (path: string): FilePath => path as FilePath;
export const unsafeAsDirectoryPath = (path: string): DirectoryPath => path as DirectoryPath;
export const unsafeAsPersonaId = (id: string): PersonaId => id as PersonaId;
export const unsafeAsContactId = (id: string): ContactId => id as ContactId;
export const unsafeAsGroupId = (id: string): GroupId => id as GroupId;
export const unsafeAsMembershipId = (id: string): MembershipId => id as MembershipId;
export const unsafeAsActivityId = (id: string): ActivityId => id as ActivityId;

const PERSONA_PREFIX = IdTypePrefixBrandSchema.parse('persona');
const CONTACT_PREFIX = IdTypePrefixBrandSchema.parse('contact');
const GROUP_PREFIX = IdTypePrefixBrandSchema.parse('group');
const MEMBERSHIP_PREFIX = IdTypePrefixBrandSchema.parse('membership');
const ACTIVITY_PREFIX = IdTypePrefixBrandSchema.parse('activity');

export const PersonaIdToolbox = createBrandedUuidToolbox(PERSONA_PREFIX, '_');
export const ContactIdToolbox = createBrandedUuidToolbox(CONTACT_PREFIX, '_');
export const GroupIdToolbox = createBrandedUuidToolbox(GROUP_PREFIX, '_');
export const MembershipIdToolbox = createBrandedUuidToolbox(MEMBERSHIP_PREFIX, '_');
export const ActivityIdToolbox = createBrandedUuidToolbox(ACTIVITY_PREFIX, '_');

export const parsePersonaId = (id: string): z.ZodSafeParseResult<PersonaId> =>
  PersonaIdToolbox.parseId(id) as unknown as z.ZodSafeParseResult<PersonaId>;
export const parseContactId = (id: string): z.ZodSafeParseResult<ContactId> =>
  ContactIdToolbox.parseId(id) as unknown as z.ZodSafeParseResult<ContactId>;
export const parseGroupId = (id: string): z.ZodSafeParseResult<GroupId> =>
  GroupIdToolbox.parseId(id) as unknown as z.ZodSafeParseResult<GroupId>;
export const parseMembershipId = (id: string): z.ZodSafeParseResult<MembershipId> =>
  MembershipIdToolbox.parseId(id) as unknown as z.ZodSafeParseResult<MembershipId>;
export const parseActivityId = (id: string): z.ZodSafeParseResult<ActivityId> =>
  ActivityIdToolbox.parseId(id) as unknown as z.ZodSafeParseResult<ActivityId>;

export const assertPersonaId = (id: string): PersonaId => PersonaIdToolbox.assertId(id) as unknown as PersonaId;
export const assertContactId = (id: string): ContactId => ContactIdToolbox.assertId(id) as unknown as ContactId;
export const assertGroupId = (id: string): GroupId => GroupIdToolbox.assertId(id) as unknown as GroupId;
export const assertMembershipId = (id: string): MembershipId =>
  MembershipIdToolbox.assertId(id) as unknown as MembershipId;
export const assertActivityId = (id: string): ActivityId =>
  ActivityIdToolbox.assertId(id) as unknown as ActivityId;

/** @deprecated Use `unsafeAsFilePath` for trusted data or `parseFilePath`/`assertFilePath` for untrusted data. */
export const asFilePath = unsafeAsFilePath;
/** @deprecated Use `unsafeAsDirectoryPath` for trusted data or `parseDirectoryPath`/`assertDirectoryPath` for untrusted data. */
export const asDirectoryPath = unsafeAsDirectoryPath;
