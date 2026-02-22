import {
  addMember,
  deleteGroup,
  getGroup,
  listGroups,
  listMembers,
  removeMember,
  setGroup
} from '@devalbo/state';
import { GroupIdToolbox, type GroupRowInput, unsafeAsGroupId } from '@devalbo/shared';
import {
  parseGroupAddMemberArgs,
  parseGroupCreateArgs,
  parseGroupEditArgs,
  parseGroupIdArgs,
  parseGroupListArgs,
  parseGroupListMembersArgs,
  parseGroupRemoveMemberArgs,
  parseGroupShowArgs
} from '@/lib/social-args.parser';
import { createElement } from 'react';
import { GroupDetailOutput } from '@/components/social/output/GroupDetailOutput';
import { GroupListOutput } from '@/components/social/output/GroupListOutput';
import { MembershipListOutput } from '@/components/social/output/MembershipListOutput';
import { makeResult, makeResultError, type StoreCommandHandler } from '@devalbo/cli-shell';

const nowIso = () => new Date().toISOString();

const applyGroupUpdates = (current: GroupRowInput, updates: Record<string, string>): GroupRowInput => {
  const next: GroupRowInput = { ...current };

  for (const [field, value] of Object.entries(updates)) {
    switch (field) {
      case 'name':
      case 'description':
      case 'url':
      case 'logo':
      case 'parentGroup':
        (next as Record<string, string>)[field] = value;
        break;
      case 'groupType':
      case 'type':
        if (value !== 'organization' && value !== 'team' && value !== 'group') {
          throw new Error(`Invalid group type: ${value}`);
        }
        next.groupType = value;
        break;
      default:
        throw new Error(`Unknown group field: ${field}`);
    }
  }

  next.updatedAt = nowIso();
  return next;
};

export const groupSubcommands: Record<string, StoreCommandHandler> = {
  list: async (args, options) => {
    const parsed = parseGroupListArgs(args);
    if (!parsed.success) return makeResultError(`Usage: group list [--type=organization|team|group]\n${parsed.error}`);

    const rows = listGroups(options.store).filter(({ row }) =>
      parsed.value.type ? row.groupType === parsed.value.type : true
    );

    const text = rows.length === 0 ? '(no groups)' : rows.map(({ id, row }) => `${id} ${row.name} (${row.groupType})`).join('\n');
    return {
      ...makeResult(text, { groups: rows }),
      component: createElement(GroupListOutput, { groups: rows })
    };
  },

  create: async (args, options) => {
    const parsed = parseGroupCreateArgs(args);
    if (!parsed.success) {
      return makeResultError(`Usage: group create <name> [--type <type>] [--description <desc>] [--url <url>] [--logo <url>] [--parent <groupId>]\n${parsed.error}`);
    }

    const id = GroupIdToolbox.createRandomId?.();
    if (!id) return makeResultError('Unable to generate group id');

    const row: GroupRowInput = {
      name: parsed.value.name,
      groupType: parsed.value.type ?? 'group',
      description: parsed.value.description ?? '',
      url: parsed.value.url ?? '',
      logo: parsed.value.logo ?? '',
      parentGroup: parsed.value.parent ?? '',
      updatedAt: nowIso()
    };

    const groupId = unsafeAsGroupId(id);
    setGroup(options.store, groupId, row);
    return {
      ...makeResult(`Created group ${groupId}`, { id: groupId, row }),
      component: createElement(GroupDetailOutput, { id: groupId, row })
    };
  },

  show: async (args, options) => {
    const parsed = parseGroupShowArgs(args);
    if (!parsed.success) return makeResultError(`Usage: group show <id> [--json]\n${parsed.error}`);

    const row = getGroup(options.store, parsed.value.id);
    if (!row) return makeResultError(`Group not found: ${parsed.value.id}`);

    if (parsed.value.json) {
      return makeResult(JSON.stringify({ id: parsed.value.id, ...row }, null, 2), { id: parsed.value.id, row });
    }

    return {
      ...makeResult(`${parsed.value.id}\nname=${row.name}\ntype=${row.groupType}`, { id: parsed.value.id, row }),
      component: createElement(GroupDetailOutput, { id: parsed.value.id, row })
    };
  },

  edit: async (args, options) => {
    const parsed = parseGroupEditArgs(args);
    if (!parsed.success) return makeResultError(`Usage: group edit <id> --field=value [--field=value ...]\n${parsed.error}`);

    const current = getGroup(options.store, parsed.value.id);
    if (!current) return makeResultError(`Group not found: ${parsed.value.id}`);

    const next = applyGroupUpdates(current, parsed.value.updates);
    setGroup(options.store, parsed.value.id, next);
    return {
      ...makeResult(`Updated group ${parsed.value.id}`, { id: parsed.value.id, row: next }),
      component: createElement(GroupDetailOutput, { id: parsed.value.id, row: next })
    };
  },

  delete: async (args, options) => {
    const parsed = parseGroupIdArgs(args);
    if (!parsed.success) return makeResultError(`Usage: group delete <id>\n${parsed.error}`);

    deleteGroup(options.store, parsed.value.id);
    return makeResult(`Deleted group ${parsed.value.id}`, { id: parsed.value.id });
  },

  'add-member': async (args, options) => {
    const parsed = parseGroupAddMemberArgs(args);
    if (!parsed.success) {
      return makeResultError(`Usage: group add-member <groupId> <contactId> [--role <role>] [--start <iso>] [--end <iso>]\n${parsed.error}`);
    }

    try {
      const membershipId = addMember(options.store, {
        groupId: parsed.value.groupId,
        contactId: parsed.value.contactId,
        role: parsed.value.role ?? '',
        startDate: parsed.value.start ?? '',
        endDate: parsed.value.end ?? ''
      });

      return makeResult(`Added member ${parsed.value.contactId} to ${parsed.value.groupId}`, {
        id: membershipId,
        ...parsed.value
      });
    } catch (error) {
      return makeResultError((error as Error).message);
    }
  },

  'remove-member': async (args, options) => {
    const parsed = parseGroupRemoveMemberArgs(args);
    if (!parsed.success) return makeResultError(`Usage: group remove-member <groupId> <contactId>\n${parsed.error}`);

    removeMember(options.store, parsed.value.groupId, parsed.value.contactId);
    return makeResult(`Removed member ${parsed.value.contactId} from ${parsed.value.groupId}`, parsed.value);
  },

  'list-members': async (args, options) => {
    const parsed = parseGroupListMembersArgs(args);
    if (!parsed.success) return makeResultError(`Usage: group list-members <groupId>\n${parsed.error}`);

    const rows = listMembers(options.store, parsed.value.groupId);
    const text = rows.length === 0
      ? '(no members)'
      : rows.map(({ id, row }) => `${id} ${row.contactId} role=${row.role || '-'}`).join('\n');

    return {
      ...makeResult(text, { members: rows, groupId: parsed.value.groupId }),
      component: createElement(MembershipListOutput, { members: rows, groupId: parsed.value.groupId })
    };
  }
};

const groupSubcommandHelp = () =>
  makeResult(
    `Usage: group <subcommand>\n\nSubcommands:\n${Object.keys(groupSubcommands)
      .map((name) => `  ${name}`)
      .join('\n')}`,
    { subcommands: Object.keys(groupSubcommands) }
  );

export const groupCommand: StoreCommandHandler = async (args, options) => {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === 'help') return groupSubcommandHelp();

  const handler = groupSubcommands[subcommand];
  if (!handler) return makeResultError(`Unknown subcommand: group ${subcommand}`);

  return handler(rest, options);
};
