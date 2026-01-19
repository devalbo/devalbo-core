import React, { useState, useCallback, useMemo } from 'react';
import { useApp, useInput } from 'ink';
import { ShellContext, ShellContextValue } from './ShellContext';

// Check if we're in a TTY environment that supports raw mode
const isTTY = typeof process !== 'undefined' && process.stdin?.isTTY === true;

interface TerminalShellProviderProps {
  children: React.ReactNode;
}

export function TerminalShellProvider({ children }: TerminalShellProviderProps) {
  const { exit } = useApp();
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  // Capture and ignore all input while a command is running (only in TTY terminals)
  useInput(() => {}, { isActive: isTTY && isCommandRunning });

  const startCommand = useCallback(() => {
    setIsCommandRunning(true);
  }, []);

  const endCommand = useCallback(() => {
    setIsCommandRunning(false);
    // In terminal CLI, exit the process when command completes
    exit();
  }, [exit]);

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
