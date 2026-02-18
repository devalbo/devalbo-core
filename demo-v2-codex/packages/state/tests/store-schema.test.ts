import { describe, expect, it } from 'vitest';
import { createZodSchematizer } from 'tinybase/schematizers/schematizer-zod';
import {
  ActivityRowStoreSchema,
  ContactRowStoreSchema,
  GroupRowStoreSchema,
  MembershipRowStoreSchema,
  PersonaRowStoreSchema
} from '@devalbo/shared';
import {
  ACTIVITIES_TABLE,
  CONTACTS_TABLE,
  GROUPS_TABLE,
  MEMBERSHIPS_TABLE,
  PERSONAS_TABLE
} from '../src/schemas/social';

describe('social store schematizer output', () => {
  it('includes enum-backed cells via store-shape schemas', () => {
    const schematizer = createZodSchematizer();

    const tablesSchema = schematizer.toTablesSchema({
      [ACTIVITIES_TABLE]: ActivityRowStoreSchema,
      [CONTACTS_TABLE]: ContactRowStoreSchema,
      [GROUPS_TABLE]: GroupRowStoreSchema
    });

    expect(tablesSchema[ACTIVITIES_TABLE]?.activityType).toEqual({ type: 'string' });
    expect(tablesSchema[CONTACTS_TABLE]?.kind).toEqual({ type: 'string' });
    expect(tablesSchema[GROUPS_TABLE]?.groupType).toEqual({ type: 'string' });
  });

  it('keeps optional string defaults as empty strings in generated schema', () => {
    const schematizer = createZodSchematizer();

    const tablesSchema = schematizer.toTablesSchema({
      [PERSONAS_TABLE]: PersonaRowStoreSchema,
      [MEMBERSHIPS_TABLE]: MembershipRowStoreSchema
    });

    expect(tablesSchema[PERSONAS_TABLE]?.nickname?.type).toBe('string');
    expect(tablesSchema[PERSONAS_TABLE]?.nickname?.default).toBe('');
    expect(tablesSchema[MEMBERSHIPS_TABLE]?.role?.type).toBe('string');
    expect(tablesSchema[MEMBERSHIPS_TABLE]?.role?.default).toBe('');
  });
});
