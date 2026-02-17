import { describe, expect, it } from 'vitest';
import { ContactIdToolbox, GroupIdToolbox, PersonaIdToolbox } from '@devalbo/shared';
import {
  parseContactLinkArgs,
  parseGroupAddMemberArgs,
  parsePersonaCreateArgs,
  parsePersonaShowArgs
} from '@/lib/social-args.parser';

describe('social arg parsers', () => {
  it('parses persona create args', () => {
    const parsed = parsePersonaCreateArgs([
      'Alice',
      '--nickname',
      'ali',
      '--email',
      'alice@example.com'
    ]);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.value.name).toBe('Alice');
      expect(parsed.value.nickname).toBe('ali');
      expect(parsed.value.email).toBe('alice@example.com');
    }
  });

  it('rejects persona show with invalid branded id', () => {
    const parsed = parsePersonaShowArgs(['not-a-persona-id']);
    expect(parsed.success).toBe(false);
  });

  it('parses contact link args with branded ids', () => {
    const contactId = ContactIdToolbox.createRandomId?.() ?? '';
    const personaId = PersonaIdToolbox.createRandomId?.() ?? '';
    const parsed = parseContactLinkArgs([contactId, personaId]);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.value.contactId).toBe(contactId);
      expect(parsed.value.personaId).toBe(personaId);
    }
  });

  it('parses group add-member args', () => {
    const groupId = GroupIdToolbox.createRandomId?.() ?? '';
    const contactId = ContactIdToolbox.createRandomId?.() ?? '';

    const parsed = parseGroupAddMemberArgs([
      groupId,
      contactId,
      '--role',
      'owner',
      '--start',
      '2026-01-01T00:00:00.000Z'
    ]);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.value.groupId).toBe(groupId);
      expect(parsed.value.contactId).toBe(contactId);
      expect(parsed.value.role).toBe('owner');
    }
  });
});
