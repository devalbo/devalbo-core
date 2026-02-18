import { useMemo } from 'react';
import type { PersonaId, PersonaRow } from '@devalbo/shared';
import { listPersonas } from '../accessors/personas';
import { PERSONAS_TABLE } from '../schemas/social';
import { useTable } from './use-table';
import { useStore } from './use-store';

export const usePersonas = (): Array<{ id: PersonaId; row: PersonaRow }> => {
  const store = useStore();
  const table = useTable(PERSONAS_TABLE);
  return useMemo(() => listPersonas(store), [store, table]);
};
