import React, { useMemo, useState } from 'react';
import { ShellContext, type ShellContextValue } from './shell-context';

export const TerminalShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  const value: ShellContextValue = useMemo(
    () => ({
      isCommandRunning,
      startCommand: () => setIsCommandRunning(true),
      endCommand: () => setIsCommandRunning(false)
    }),
    [isCommandRunning]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
};
