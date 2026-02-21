import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getSolidSession,
  handleIncomingRedirect,
  subscribeSolidSession,
  type SolidSession
} from './session';

export const SolidSessionContext = createContext<SolidSession | null>(null);

export const SolidSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SolidSession | null>(() => getSolidSession());

  useEffect(() => {
    const unsubscribe = subscribeSolidSession(setSession);
    void handleIncomingRedirect().then(setSession);
    return unsubscribe;
  }, []);

  return (
    <SolidSessionContext.Provider value={session}>
      {children}
    </SolidSessionContext.Provider>
  );
};

export const useSolidSession = (): SolidSession | null => useContext(SolidSessionContext);
