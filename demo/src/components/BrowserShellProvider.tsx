import React, { useState, useCallback, useMemo } from 'react';
import { ShellContext, ShellContextValue } from './ShellContext';

interface BrowserShellProviderProps {
  children: React.ReactNode;
}

export function BrowserShellProvider({ children }: BrowserShellProviderProps) {
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  const startCommand = useCallback(() => {
    setIsCommandRunning(true);
  }, []);

  const endCommand = useCallback(() => {
    setIsCommandRunning(false);
    // In browser, we just release input - no exit needed
  }, []);

  const value: ShellContextValue = useMemo(() => ({
    isCommandRunning,
    startCommand,
    endCommand,
  }), [isCommandRunning, startCommand, endCommand]);

  return (
    <ShellContext.Provider value={value}>
      {children}
    </ShellContext.Provider>
  );
}
