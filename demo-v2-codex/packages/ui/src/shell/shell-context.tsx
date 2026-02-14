import { createContext, useContext } from 'react';

export interface ShellContextValue {
  isCommandRunning: boolean;
  startCommand: () => void;
  endCommand: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export const useShell = (): ShellContextValue => {
  const context = useContext(ShellContext);
  if (!context) {
    return {
      isCommandRunning: false,
      startCommand: () => {},
      endCommand: () => {}
    };
  }
  return context;
};

export { ShellContext };
