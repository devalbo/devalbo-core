import {
  deleteContact,
  getContact,
  linkContactToPersona,
  listContacts,
  searchContacts,
  setContact
} from '@devalbo/state';
import { ContactIdToolbox, type ContactRowInput, unsafeAsContactId } from '@devalbo/shared';
import {
  parseContactAddArgs,
  parseContactEditArgs,
  parseContactIdArgs,
  parseContactLinkArgs,
  parseContactListArgs,
  parseContactSearchArgs,
  parseContactShowArgs
} from '@/lib/social-args.parser';
import { createElement } from 'react';
import { ContactDetailOutput } from '@/components/social/output/ContactDetailOutput';
import { ContactListOutput } from '@/components/social/output/ContactListOutput';
import { makeResult, makeResultError, type SocialCommandHandler } from './_util';

const nowIso = () => new Date().toISOString();

const applyContactUpdates = (current: ContactRowInput, updates: Record<string, string>): ContactRowInput => {
  const next: ContactRowInput = { ...current };
  for (const [field, value] of Object.entries(updates)) {
    switch (field) {
      case 'name':
      case 'uid':
      case 'nickname':
      case 'email':
      case 'phone':
      case 'url':
      case 'photo':
      case 'notes':
      case 'organization':
      case 'role':
      case 'webId':
      case 'agentCategory':
      case 'linkedPersona':
        (next as Record<string, string>)[field] = value;
        break;
      case 'kind':
        if (value !== 'person' && value !== 'agent') throw new Error(`Invalid contact kind: ${value}`);
        next.kind = value;
        break;
      default:
        throw new Error(`Unknown contact field: ${field}`);
    }
  }
  next.updatedAt = nowIso();
  return next;
};

export const contactSubcommands: Record<string, SocialCommandHandler> = {
  list: async (args, options) => {
    const parsed = parseContactListArgs(args);
    if (!parsed.success) return makeResultError(`Usage: contact list [--agents] [--people]\n${parsed.error}`);

    const rows = listContacts(options.store).filter(({ row }) => {
      if (parsed.value.agents && !parsed.value.people) return row.kind === 'agent';
      if (!parsed.value.agents && parsed.value.people) return row.kind === 'person';
      return true;
    });

    const text = rows.length === 0 ? '(no contacts)' : rows.map(({ id, row }) => `${id} ${row.name} (${row.kind})`).join('\n');
    return {
      ...makeResult(text, { contacts: rows }),
      component: createElement(ContactListOutput, { contacts: rows })
    };
  },

  add: async (args, options) => {
    const parsed = parseContactAddArgs(args);
    if (!parsed.success) {
      return makeResultError(`Usage: contact add <name> [--email <email>] [--phone <phone>] [--org <org>] [--agent] [--category <category>]\n${parsed.error}`);
    }

    const id = ContactIdToolbox.createRandomId?.();
    if (!id) return makeResultError('Unable to generate contact id');

    const row: ContactRowInput = {
      name: parsed.value.name,
      uid: `urn:uuid:${crypto.randomUUID()}`,
      nickname: '',
      kind: parsed.value.agent ? 'agent' : 'person',
      email: parsed.value.email ?? '',
      phone: parsed.value.phone ?? '',
      url: '',
      photo: '',
      notes: '',
      organization: parsed.value.org ?? '',
      role: '',
      webId: '',
      agentCategory: parsed.value.category ?? '',
      linkedPersona: '',
      updatedAt: nowIso()
    };

    const contactId = unsafeAsContactId(id);
    setContact(options.store, contactId, row);
    return {
      ...makeResult(`Created contact ${contactId}`, { id: contactId, row }),
      component: createElement(ContactDetailOutput, { id: contactId, row })
    };
  },

  show: async (args, options) => {
    const parsed = parseContactShowArgs(args);
    if (!parsed.success) return makeResultError(`Usage: contact show <id> [--json]\n${parsed.error}`);

    const row = getContact(options.store, parsed.value.id);
    if (!row) return makeResultError(`Contact not found: ${parsed.value.id}`);

    if (parsed.value.json) {
      return makeResult(JSON.stringify({ id: parsed.value.id, ...row }, null, 2), { id: parsed.value.id, row });
    }

    return {
      ...makeResult(`${parsed.value.id}\nname=${row.name}\nkind=${row.kind}\nemail=${row.email}`, {
        id: parsed.value.id,
        row
      }),
      component: createElement(ContactDetailOutput, { id: parsed.value.id, row })
    };
  },

  edit: async (args, options) => {
    const parsed = parseContactEditArgs(args);
    if (!parsed.success) return makeResultError(`Usage: contact edit <id> --field=value [--field=value ...]\n${parsed.error}`);

    const current = getContact(options.store, parsed.value.id);
    if (!current) return makeResultError(`Contact not found: ${parsed.value.id}`);

    const next = applyContactUpdates(current, parsed.value.updates);
    setContact(options.store, parsed.value.id, next);
    return {
      ...makeResult(`Updated contact ${parsed.value.id}`, { id: parsed.value.id, row: next }),
      component: createElement(ContactDetailOutput, { id: parsed.value.id, row: next })
    };
  },

  delete: async (args, options) => {
    const parsed = parseContactIdArgs(args);
    if (!parsed.success) return makeResultError(`Usage: contact delete <id>\n${parsed.error}`);

    deleteContact(options.store, parsed.value.id);
    return makeResult(`Deleted contact ${parsed.value.id}`, { id: parsed.value.id });
  },

  search: async (args, options) => {
    const parsed = parseContactSearchArgs(args);
    if (!parsed.success) return makeResultError(`Usage: contact search <query>\n${parsed.error}`);

    const rows = searchContacts(options.store, parsed.value.query);
    const text = rows.length === 0 ? '(no matches)' : rows.map(({ id, row }) => `${id} ${row.name}`).join('\n');
    return {
      ...makeResult(text, { contacts: rows, query: parsed.value.query }),
      component: createElement(ContactListOutput, { contacts: rows, query: parsed.value.query })
    };
  },

  link: async (args, options) => {
    const parsed = parseContactLinkArgs(args);
    if (!parsed.success) return makeResultError(`Usage: contact link <contactId> <personaId>\n${parsed.error}`);

    try {
      linkContactToPersona(options.store, parsed.value.contactId, parsed.value.personaId);
      return makeResult(`Linked contact ${parsed.value.contactId} to persona ${parsed.value.personaId}`, parsed.value);
    } catch (error) {
      return makeResultError((error as Error).message);
    }
  }
};

const contactSubcommandHelp = () =>
  makeResult(
    `Usage: contact <subcommand>\n\nSubcommands:\n${Object.keys(contactSubcommands)
      .map((name) => `  ${name}`)
      .join('\n')}`,
    { subcommands: Object.keys(contactSubcommands) }
  );

export const contactCommand: SocialCommandHandler = async (args, options) => {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === 'help') return contactSubcommandHelp();

  const handler = contactSubcommands[subcommand];
  if (!handler) return makeResultError(`Unknown subcommand: contact ${subcommand}`);

  return handler(rest, options);
};
