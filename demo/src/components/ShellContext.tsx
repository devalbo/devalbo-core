import React, { createContext, useContext } from 'react';

export interface ShellContextValue {
  /** Whether a blocking command is currently running */
  isCommandRunning: boolean;
  /** Call when a blocking command starts */
  startCommand: () => void;
  /** Call when a blocking command ends */
  endCommand: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    // Return a no-op implementation for components rendered outside a shell
    return {
      isCommandRunning: false,
      startCommand: () => {},
      endCommand: () => {},
    };
  }
  return context;
}

export { ShellContext };
