import { createStore, type Store } from 'tinybase';
import { createZodSchematizer } from 'tinybase/schematizers/schematizer-zod';
import {
  ActivityRowStoreSchema,
  ContactRowStoreSchema,
  GroupRowStoreSchema,
  MembershipRowStoreSchema,
  PersonaRowStoreSchema
} from '@devalbo/shared';
import {
  CONTACTS_TABLE,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_PERSONA_ID_VALUE,
  GROUPS_TABLE,
  ACTIVITIES_TABLE,
  MEMBERSHIPS_TABLE,
  PERSONAS_TABLE,
  SCHEMA_VERSION_VALUE
} from './schemas/social';

export const createDevalboStore = (): Store => {
  const store = createStore();
  const schematizer = createZodSchematizer();

  const socialTablesSchema = schematizer.toTablesSchema({
    [PERSONAS_TABLE]: PersonaRowStoreSchema,
    [CONTACTS_TABLE]: ContactRowStoreSchema,
    [GROUPS_TABLE]: GroupRowStoreSchema,
    [MEMBERSHIPS_TABLE]: MembershipRowStoreSchema,
    [ACTIVITIES_TABLE]: ActivityRowStoreSchema
  });

  store.setTablesSchema({
    entries: {
      path: { type: 'string' },
      name: { type: 'string' },
      parentPath: { type: 'string' },
      isDirectory: { type: 'boolean' },
      size: { type: 'number' },
      mtime: { type: 'string' }
    },
    buffers: {
      path: { type: 'string' },
      content: { type: 'string' },
      isDirty: { type: 'boolean' },
      cursorLine: { type: 'number' },
      cursorCol: { type: 'number' }
    },
    sync_roots: {
      label: { type: 'string' },
      localPath: { type: 'string' },
      podUrl: { type: 'string' },
      webId: { type: 'string' },
      readonly: { type: 'boolean' },
      enabled: { type: 'boolean' }
    },
    file_sync_state: {
      path: { type: 'string' },
      syncRootId: { type: 'string' },
      podEtag: { type: 'string' },
      contentHash: { type: 'string' },
      status: { type: 'string' }
    },
    ...socialTablesSchema
  });

  store.setValuesSchema({
    [DEFAULT_PERSONA_ID_VALUE]: { type: 'string', default: '' },
    [SCHEMA_VERSION_VALUE]: { type: 'number', default: CURRENT_SCHEMA_VERSION }
  });

  const schemaVersion = store.getValue(SCHEMA_VERSION_VALUE);
  if (schemaVersion == null || schemaVersion === 0) {
    store.setValue(SCHEMA_VERSION_VALUE, CURRENT_SCHEMA_VERSION);
  } else if (typeof schemaVersion === 'number' && schemaVersion > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[devalbo-state] Store schema version (${schemaVersion}) is newer than supported (${CURRENT_SCHEMA_VERSION}).` +
      ' Unknown tables/values may be ignored by this runtime.'
    );
  }

  return store;
};

export type DevalboStore = Store;
