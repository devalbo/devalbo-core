import { argument, formatMessage, object, optional, option, parse, string, type Parser } from '@optique/core';
import { z } from 'zod';
import {
  ContactAddArgsSchema,
  ContactEditArgsSchema,
  ContactIdArgsSchema,
  ContactLinkArgsSchema,
  ContactListArgsSchema,
  ContactSearchArgsSchema,
  ContactShowArgsSchema,
  GroupAddMemberArgsSchema,
  GroupCreateArgsSchema,
  GroupEditArgsSchema,
  GroupIdArgsSchema,
  GroupListArgsSchema,
  GroupListMembersArgsSchema,
  GroupRemoveMemberArgsSchema,
  GroupShowArgsSchema,
  PersonaCreateArgsSchema,
  PersonaEditArgsSchema,
  PersonaIdArgsSchema,
  PersonaShowArgsSchema,
  type ContactAddArgs,
  type ContactEditArgs,
  type ContactIdArgs,
  type ContactLinkArgs,
  type ContactListArgs,
  type ContactSearchArgs,
  type ContactShowArgs,
  type GroupAddMemberArgs,
  type GroupCreateArgs,
  type GroupEditArgs,
  type GroupIdArgs,
  type GroupListArgs,
  type GroupListMembersArgs,
  type GroupRemoveMemberArgs,
  type GroupShowArgs,
  type PersonaCreateArgs,
  type PersonaEditArgs,
  type PersonaIdArgs,
  type PersonaShowArgs
} from './social-args.schema';

type ParseResult<T> = { success: true; value: T } | { success: false; error: string };

const zodErrorToMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join('; ');

const parseWithSchema = <TParsed, TOutput>(
  parser: Parser<'sync', TParsed, unknown>,
  args: string[],
  schema: z.ZodType<TOutput>,
): ParseResult<TOutput> => {
  const result = parse(parser, args);
  if (!result.success) {
    return { success: false, error: formatMessage(result.error) };
  }

  const validated = schema.safeParse(result.value);
  if (!validated.success) {
    return { success: false, error: zodErrorToMessage(validated.error) };
  }

  return { success: true, value: validated.data };
};

const parseIdAndUpdates = (args: string[], schema: z.ZodTypeAny): ParseResult<unknown> => {
  const [id, ...rest] = args;
  const updates: Record<string, string> = {};

  for (const token of rest) {
    if (!token.startsWith('--')) {
      return { success: false, error: `Invalid edit token: ${token}. Expected --field=value.` };
    }

    const body = token.slice(2);
    const eqIdx = body.indexOf('=');
    if (eqIdx <= 0) {
      return { success: false, error: `Invalid edit token: ${token}. Expected --field=value.` };
    }

    const field = body.slice(0, eqIdx).trim();
    const value = body.slice(eqIdx + 1).trim();
    updates[field] = value;
  }

  const parsed = schema.safeParse({ id, updates });
  if (!parsed.success) {
    return { success: false, error: zodErrorToMessage(parsed.error) };
  }

  return { success: true, value: parsed.data };
};

const personaCreateParser = object({
  name: argument(string()),
  nickname: optional(option('--nickname', string())),
  email: optional(option('--email', string())),
  bio: optional(option('--bio', string())),
  homepage: optional(option('--homepage', string())),
  image: optional(option('--image', string()))
});

const personaShowParser = object({
  id: argument(string()),
  json: option('--json')
});

const idParser = object({ id: argument(string()) });

const contactListParser = object({
  agents: option('--agents'),
  people: option('--people')
});

const contactAddParser = object({
  name: argument(string()),
  email: optional(option('--email', string())),
  phone: optional(option('--phone', string())),
  org: optional(option('--org', string())),
  agent: option('--agent'),
  category: optional(option('--category', string()))
});

const contactShowParser = object({
  id: argument(string()),
  json: option('--json')
});

const contactSearchParser = object({ query: argument(string()) });

const contactLinkParser = object({
  contactId: argument(string()),
  personaId: argument(string())
});

const groupListParser = object({
  type: optional(option('--type', string()))
});

const groupCreateParser = object({
  name: argument(string()),
  type: optional(option('--type', string())),
  description: optional(option('--description', string())),
  url: optional(option('--url', string())),
  logo: optional(option('--logo', string())),
  parent: optional(option('--parent', string()))
});

const groupShowParser = object({
  id: argument(string()),
  json: option('--json')
});

const groupAddMemberParser = object({
  groupId: argument(string()),
  contactId: argument(string()),
  role: optional(option('--role', string())),
  start: optional(option('--start', string())),
  end: optional(option('--end', string()))
});

const groupRemoveMemberParser = object({
  groupId: argument(string()),
  contactId: argument(string())
});

const groupListMembersParser = object({
  groupId: argument(string())
});

export const parsePersonaIdArg = (args: string[]): ParseResult<PersonaIdArgs> =>
  parseWithSchema(idParser, args, PersonaIdArgsSchema);
export const parsePersonaCreateArgs = (args: string[]): ParseResult<PersonaCreateArgs> =>
  parseWithSchema(personaCreateParser, args, PersonaCreateArgsSchema);
export const parsePersonaShowArgs = (args: string[]): ParseResult<PersonaShowArgs> =>
  parseWithSchema(personaShowParser, args, PersonaShowArgsSchema);
export const parsePersonaEditArgs = (args: string[]): ParseResult<PersonaEditArgs> =>
  parseIdAndUpdates(args, PersonaEditArgsSchema) as ParseResult<PersonaEditArgs>;

export const parseContactListArgs = (args: string[]): ParseResult<ContactListArgs> =>
  parseWithSchema(contactListParser, args, ContactListArgsSchema);
export const parseContactAddArgs = (args: string[]): ParseResult<ContactAddArgs> =>
  parseWithSchema(contactAddParser, args, ContactAddArgsSchema);
export const parseContactShowArgs = (args: string[]): ParseResult<ContactShowArgs> =>
  parseWithSchema(contactShowParser, args, ContactShowArgsSchema);
export const parseContactEditArgs = (args: string[]): ParseResult<ContactEditArgs> =>
  parseIdAndUpdates(args, ContactEditArgsSchema) as ParseResult<ContactEditArgs>;
export const parseContactIdArgs = (args: string[]): ParseResult<ContactIdArgs> =>
  parseWithSchema(idParser, args, ContactIdArgsSchema);
export const parseContactSearchArgs = (args: string[]): ParseResult<ContactSearchArgs> =>
  parseWithSchema(contactSearchParser, args, ContactSearchArgsSchema);
export const parseContactLinkArgs = (args: string[]): ParseResult<ContactLinkArgs> =>
  parseWithSchema(contactLinkParser, args, ContactLinkArgsSchema);

export const parseGroupListArgs = (args: string[]): ParseResult<GroupListArgs> =>
  parseWithSchema(groupListParser, args, GroupListArgsSchema);
export const parseGroupCreateArgs = (args: string[]): ParseResult<GroupCreateArgs> =>
  parseWithSchema(groupCreateParser, args, GroupCreateArgsSchema);
export const parseGroupShowArgs = (args: string[]): ParseResult<GroupShowArgs> =>
  parseWithSchema(groupShowParser, args, GroupShowArgsSchema);
export const parseGroupEditArgs = (args: string[]): ParseResult<GroupEditArgs> =>
  parseIdAndUpdates(args, GroupEditArgsSchema) as ParseResult<GroupEditArgs>;
export const parseGroupIdArgs = (args: string[]): ParseResult<GroupIdArgs> =>
  parseWithSchema(idParser, args, GroupIdArgsSchema);
export const parseGroupAddMemberArgs = (args: string[]): ParseResult<GroupAddMemberArgs> =>
  parseWithSchema(groupAddMemberParser, args, GroupAddMemberArgsSchema);
export const parseGroupRemoveMemberArgs = (args: string[]): ParseResult<GroupRemoveMemberArgs> =>
  parseWithSchema(groupRemoveMemberParser, args, GroupRemoveMemberArgsSchema);
export const parseGroupListMembersArgs = (args: string[]): ParseResult<GroupListMembersArgs> =>
  parseWithSchema(groupListMembersParser, args, GroupListMembersArgsSchema);
