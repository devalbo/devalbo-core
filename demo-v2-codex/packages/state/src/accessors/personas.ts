import type { Row, Store } from 'tinybase';
import { PersonaRowSchema, type PersonaRow, type PersonaRowInput } from '@devalbo/shared';
import { DEFAULT_PERSONA_ID_VALUE, PERSONAS_TABLE } from '../schemas/social';
import { safeParseWithWarning } from './_validation';

export const getPersona = (store: Store, id: string): PersonaRow | null => {
  if (!store.hasRow(PERSONAS_TABLE, id)) return null;
  const row = store.getRow(PERSONAS_TABLE, id);
  return safeParseWithWarning<PersonaRow>(PersonaRowSchema, row, PERSONAS_TABLE, id, 'get');
};

export const setPersona = (store: Store, id: string, persona: PersonaRowInput): void => {
  const parsed = PersonaRowSchema.parse(persona);
  store.setRow(PERSONAS_TABLE, id, parsed as Row);
  if (parsed.isDefault) {
    setDefaultPersona(store, id);
    return;
  }

  const currentDefaultId = store.getValue(DEFAULT_PERSONA_ID_VALUE);
  if (currentDefaultId === id) {
    store.setValue(DEFAULT_PERSONA_ID_VALUE, '');
  }
};

export const listPersonas = (store: Store): Array<{ id: string; row: PersonaRow }> => {
  const table = store.getTable(PERSONAS_TABLE);
  if (!table) return [];

  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = safeParseWithWarning<PersonaRow>(PersonaRowSchema, row, PERSONAS_TABLE, id, 'list');
    return parsed ? [{ id, row: parsed }] : [];
  });
};

export const deletePersona = (store: Store, id: string): void => {
  const defaultPersona = store.getValue(DEFAULT_PERSONA_ID_VALUE);
  store.delRow(PERSONAS_TABLE, id);
  if (defaultPersona === id) {
    store.setValue(DEFAULT_PERSONA_ID_VALUE, '');
  }
};

export const getDefaultPersona = (store: Store): { id: string; row: PersonaRow } | null => {
  const defaultId = store.getValue(DEFAULT_PERSONA_ID_VALUE);
  if (typeof defaultId !== 'string' || defaultId.trim() === '') return null;

  const row = getPersona(store, defaultId);
  return row ? { id: defaultId, row } : null;
};

export const setDefaultPersona = (store: Store, id: string): void => {
  const existing = getPersona(store, id);
  if (!existing) {
    throw new Error(`Persona not found: ${id}`);
  }

  for (const { id: personaId, row } of listPersonas(store)) {
    if (row.isDefault) {
      store.setCell(PERSONAS_TABLE, personaId, 'isDefault', false);
    }
  }

  store.setCell(PERSONAS_TABLE, id, 'isDefault', true);
  store.setValue(DEFAULT_PERSONA_ID_VALUE, id);
};
