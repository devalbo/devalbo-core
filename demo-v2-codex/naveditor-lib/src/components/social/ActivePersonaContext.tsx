import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PersonaId } from '@devalbo/shared';
import { usePersonas } from '@devalbo/state';

export interface ActivePersonaContextValue {
  activePersonaId: PersonaId | null;
  setActivePersonaId: (id: PersonaId | null) => void;
}

const ActivePersonaContext = createContext<ActivePersonaContextValue | null>(null);

export const useActivePersona = (): ActivePersonaContextValue => {
  const value = useContext(ActivePersonaContext);
  if (!value) {
    throw new Error('ActivePersonaContext is not available');
  }
  return value;
};

export const ActivePersonaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const personas = usePersonas();
  const [activePersonaId, setActivePersonaId] = useState<PersonaId | null>(null);

  useEffect(() => {
    const defaultPersona = personas.find(({ row }) => row.isDefault);
    const fallback = defaultPersona?.id ?? personas[0]?.id ?? null;

    setActivePersonaId((previous) => {
      if (previous && personas.some(({ id }) => id === previous)) return previous;
      return fallback;
    });
  }, [personas]);

  const value = useMemo(
    () => ({ activePersonaId, setActivePersonaId }),
    [activePersonaId]
  );

  return <ActivePersonaContext.Provider value={value}>{children}</ActivePersonaContext.Provider>;
};
