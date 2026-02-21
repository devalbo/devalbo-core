import { z } from 'zod';
import {
  createBrandedNonNegativeIntSchema,
  createBrandedUuidToolbox,
  IdTypePrefixBrandSchema,
  type Branded,
  type BrandedNumber
} from '@devalbo/branded-types';

export type { Branded };

export type FilePath = Branded<string, 'FilePath'>;
export type DirectoryPath = Branded<string, 'DirectoryPath'>;
export type PersonaId = Branded<string, 'PersonaId'>;
export type ContactId = Branded<string, 'ContactId'>;
export type GroupId = Branded<string, 'GroupId'>;
export type MembershipId = Branded<string, 'MembershipId'>;
export type ActivityId = Branded<string, 'ActivityId'>;
export type SyncRootId = Branded<string, 'SyncRootId'>;
export type AbsolutePath = Branded<string, 'AbsolutePath'>;
export type PodUrl = Branded<string, 'PodUrl'>;
export type WebId = Branded<string, 'WebId'>;
export type ContentHash = Branded<string, 'ContentHash'>;
export type PodETag = Branded<string, 'PodETag'>;
export type RelativePath = Branded<string, 'RelativePath'>;
export type Milliseconds = BrandedNumber<'Milliseconds'>;
export type ByteCount = BrandedNumber<'ByteCount'>;

export const FilePathSchema = z.string().trim().min(1, 'path is required').transform((path) => path as FilePath);
export const DirectoryPathSchema = z
  .string()
  .trim()
  .min(1, 'path is required')
  .refine((path) => path.startsWith('/'), 'directory path must be absolute (start with "/")')
  .refine((path) => path.endsWith('/'), 'directory path must end with "/"')
  .transform((path) => path as DirectoryPath);
export const AbsolutePathSchema = z
  .string()
  .trim()
  .min(1, 'path is required')
  .refine((path) => path.startsWith('/'), 'absolute path must start with "/"')
  .transform((path) => path as AbsolutePath);
export const PodUrlSchema = z
  .string()
  .url()
  .refine((value) => value.endsWith('/'), 'pod URL must end with "/"')
  .transform((value) => value as PodUrl);
export const WebIdSchema = z.string().url().transform((value) => value as WebId);
export const ContentHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'content hash must be a 64-char lowercase hex string')
  .transform((value) => value as ContentHash);
export const PodETagSchema = z.string().min(1, 'etag is required').transform((value) => value as PodETag);
export const RelativePathSchema = z
  .string()
  .trim()
  .refine((path) => !path.startsWith('/'), 'relative path must not start with "/"')
  .transform((path) => path as RelativePath);
export const SyncRootIdSchema = z.string().uuid().transform((value) => value as SyncRootId);
export const MillisecondsSchema = createBrandedNonNegativeIntSchema('Milliseconds');
export const ByteCountSchema = createBrandedNonNegativeIntSchema('ByteCount');

export const parseFilePath = (path: string): z.ZodSafeParseResult<FilePath> => FilePathSchema.safeParse(path);
export const parseDirectoryPath = (path: string): z.ZodSafeParseResult<DirectoryPath> =>
  DirectoryPathSchema.safeParse(path);
export const parseAbsolutePath = (path: string): z.ZodSafeParseResult<AbsolutePath> => AbsolutePathSchema.safeParse(path);
export const parsePodUrl = (url: string): z.ZodSafeParseResult<PodUrl> => PodUrlSchema.safeParse(url);
export const parseWebId = (webId: string): z.ZodSafeParseResult<WebId> => WebIdSchema.safeParse(webId);

export const assertFilePath = (path: string): FilePath => FilePathSchema.parse(path);
export const assertDirectoryPath = (path: string): DirectoryPath => DirectoryPathSchema.parse(path);
export const assertAbsolutePath = (path: string): AbsolutePath => AbsolutePathSchema.parse(path);
export const assertPodUrl = (url: string): PodUrl => PodUrlSchema.parse(url);
export const assertWebId = (webId: string): WebId => WebIdSchema.parse(webId);
export const assertSyncRootId = (id: string): SyncRootId => SyncRootIdSchema.parse(id);
export const assertContentHash = (hash: string): ContentHash => ContentHashSchema.parse(hash);

export const unsafeAsFilePath = (path: string): FilePath => path as FilePath;
export const unsafeAsDirectoryPath = (path: string): DirectoryPath => path as DirectoryPath;
export const unsafeAsAbsolutePath = (path: string): AbsolutePath => path as AbsolutePath;
export const unsafeAsPodUrl = (url: string): PodUrl => url as PodUrl;
export const unsafeAsWebId = (webId: string): WebId => webId as WebId;
export const unsafeAsSyncRootId = (id: string): SyncRootId => id as SyncRootId;
export const unsafeAsContentHash = (hash: string): ContentHash => hash as ContentHash;
export const unsafeAsPodETag = (etag: string): PodETag => etag as PodETag;
export const unsafeAsRelativePath = (path: string): RelativePath => path as RelativePath;
export const unsafeAsMilliseconds = (value: number): Milliseconds => value as Milliseconds;
export const unsafeAsByteCount = (value: number): ByteCount => value as ByteCount;
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
