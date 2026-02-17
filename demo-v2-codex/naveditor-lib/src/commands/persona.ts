import {
  deletePersona,
  getDefaultPersona,
  getPersona,
  listPersonas,
  setDefaultPersona,
  setPersona
} from '@devalbo/state';
import { PersonaIdToolbox, type PersonaRowInput, unsafeAsPersonaId } from '@devalbo/shared';
import {
  parsePersonaCreateArgs,
  parsePersonaEditArgs,
  parsePersonaIdArg,
  parsePersonaShowArgs
} from '@/lib/social-args.parser';
import { makeResult, makeResultError, type SocialCommandHandler } from './_util';

const nowIso = () => new Date().toISOString();

const applyPersonaUpdates = (current: PersonaRowInput, updates: Record<string, string>): PersonaRowInput => {
  const next: PersonaRowInput = { ...current };
  for (const [field, value] of Object.entries(updates)) {
    switch (field) {
      case 'name':
      case 'nickname':
      case 'givenName':
      case 'familyName':
      case 'email':
      case 'phone':
      case 'image':
      case 'bio':
      case 'homepage':
      case 'oidcIssuer':
      case 'inbox':
      case 'publicTypeIndex':
      case 'privateTypeIndex':
      case 'preferencesFile':
      case 'profileDoc':
        (next as unknown as Record<string, string>)[field] = value;
        break;
      case 'isDefault':
        next.isDefault = value === 'true';
        break;
      default:
        throw new Error(`Unknown persona field: ${field}`);
    }
  }
  next.updatedAt = nowIso();
  return next;
};

export const personaSubcommands: Record<string, SocialCommandHandler> = {
  list: async (_args, options) => {
    const rows = listPersonas(options.store);
    const defaultPersona = getDefaultPersona(options.store);
    const text = rows.length === 0
      ? '(no personas)'
      : rows.map(({ id, row }) => `${id}${defaultPersona?.id === id ? ' (default)' : ''} ${row.name}`).join('\n');
    return makeResult(text, { personas: rows, defaultPersona });
  },

  create: async (args, options) => {
    const parsed = parsePersonaCreateArgs(args);
    if (!parsed.success) {
      return makeResultError(`Usage: persona create <name> [--nickname <nick>] [--email <email>] [--bio <bio>] [--homepage <url>] [--image <url>]\n${parsed.error}`);
    }

    const id = PersonaIdToolbox.createRandomId?.();
    if (!id) return makeResultError('Unable to generate persona id');

    const row: PersonaRowInput = {
      name: parsed.value.name,
      nickname: parsed.value.nickname ?? '',
      givenName: '',
      familyName: '',
      email: parsed.value.email ?? '',
      phone: '',
      image: parsed.value.image ?? '',
      bio: parsed.value.bio ?? '',
      homepage: parsed.value.homepage ?? '',
      oidcIssuer: '',
      inbox: '',
      publicTypeIndex: '',
      privateTypeIndex: '',
      preferencesFile: '',
      profileDoc: '',
      isDefault: false,
      updatedAt: nowIso()
    };

    const personaId = unsafeAsPersonaId(id);
    setPersona(options.store, personaId, row);
    return makeResult(`Created persona ${personaId}`, { id: personaId, row });
  },

  show: async (args, options) => {
    const parsed = parsePersonaShowArgs(args);
    if (!parsed.success) return makeResultError(`Usage: persona show <id> [--json]\n${parsed.error}`);

    const row = getPersona(options.store, parsed.value.id);
    if (!row) return makeResultError(`Persona not found: ${parsed.value.id}`);

    if (parsed.value.json) {
      return makeResult(JSON.stringify({ id: parsed.value.id, ...row }, null, 2), { id: parsed.value.id, row });
    }

    return makeResult(`${parsed.value.id}\nname=${row.name}\nemail=${row.email}`, { id: parsed.value.id, row });
  },

  edit: async (args, options) => {
    const parsed = parsePersonaEditArgs(args);
    if (!parsed.success) return makeResultError(`Usage: persona edit <id> --field=value [--field=value ...]\n${parsed.error}`);

    const current = getPersona(options.store, parsed.value.id);
    if (!current) return makeResultError(`Persona not found: ${parsed.value.id}`);

    const next = applyPersonaUpdates(current, parsed.value.updates);
    setPersona(options.store, parsed.value.id, next);
    return makeResult(`Updated persona ${parsed.value.id}`, { id: parsed.value.id, row: next });
  },

  delete: async (args, options) => {
    const parsed = parsePersonaIdArg(args);
    if (!parsed.success) return makeResultError(`Usage: persona delete <id>\n${parsed.error}`);

    deletePersona(options.store, parsed.value.id);
    return makeResult(`Deleted persona ${parsed.value.id}`, { id: parsed.value.id });
  },

  'set-default': async (args, options) => {
    const parsed = parsePersonaIdArg(args);
    if (!parsed.success) return makeResultError(`Usage: persona set-default <id>\n${parsed.error}`);

    try {
      setDefaultPersona(options.store, parsed.value.id);
      return makeResult(`Default persona set to ${parsed.value.id}`, { id: parsed.value.id });
    } catch (error) {
      return makeResultError((error as Error).message);
    }
  }
};

const personaSubcommandHelp = () =>
  makeResult(
    `Usage: persona <subcommand>\n\nSubcommands:\n${Object.keys(personaSubcommands)
      .map((name) => `  ${name}`)
      .join('\n')}`,
    { subcommands: Object.keys(personaSubcommands) }
  );

export const personaCommand: SocialCommandHandler = async (args, options) => {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === 'help') return personaSubcommandHelp();

  const handler = personaSubcommands[subcommand];
  if (!handler) return makeResultError(`Unknown subcommand: persona ${subcommand}`);

  return handler(rest, options);
};
