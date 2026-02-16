import type { Row, Store } from 'tinybase';
import { EditorBufferRowSchema, type EditorBufferRow } from '@devalbo/shared';
import { EDITOR_BUFFER_TABLE } from '../schemas/editor-buffer';

export const getBuffer = (store: Store, id: string): EditorBufferRow | null => {
  const row = store.getRow(EDITOR_BUFFER_TABLE, id);
  if (row == null) return null;

  const parsed = EditorBufferRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
};

export const setBuffer = (store: Store, id: string, buffer: EditorBufferRow): void => {
  const parsed = EditorBufferRowSchema.parse(buffer);
  store.setRow(EDITOR_BUFFER_TABLE, id, parsed as Row);
};

export const listBuffers = (store: Store): Array<{ id: string; row: EditorBufferRow }> => {
  const table = store.getTable(EDITOR_BUFFER_TABLE);
  if (!table) return [];

  return Object.entries(table).flatMap(([id, row]) => {
    const parsed = EditorBufferRowSchema.safeParse(row);
    return parsed.success ? [{ id, row: parsed.data }] : [];
  });
};

export const deleteBuffer = (store: Store, id: string): void => {
  store.delRow(EDITOR_BUFFER_TABLE, id);
};
