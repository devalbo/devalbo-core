import React, { useMemo, useState, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@devalbo/ui';
import { BrowserShellProvider } from './BrowserShellProvider';
import { TerminalShellProvider } from './TerminalShellProvider';
import {
  BrowserConnectivityService,
  type AppConfig,
  detectPlatform,
  RuntimePlatform,
  type IConnectivityService
} from '@devalbo/shared';
import { createDevalboStore, type DevalboStore } from '@devalbo/state';
import type { IFilesystemDriver } from '@devalbo/filesystem';
import type { CommandHandler } from '../commands/_util';
import { executeCommandRaw, parseCommandLine } from '../lib/command-runtime';

interface CommandOutput {
  command?: string;
  component?: ReactNode;
}

function ShellContent({
  commands,
  createProgram,
  runtime,
  store,
  config,
  driver,
  cwd,
  setCwd,
  session,
  welcomeMessage
}: {
  commands: Record<string, CommandHandler>;
  createProgram?: () => import('commander').Command;
  runtime: 'browser' | 'terminal';
  store: DevalboStore;
  config?: AppConfig;
  driver?: IFilesystemDriver | null;
  cwd: string;
  setCwd: (next: string) => void;
  session?: unknown | null;
  welcomeMessage: string | ReactNode;
}) {
  const [connectivity] = useState<IConnectivityService>(() => new BrowserConnectivityService());
  const [input, setInput] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      component: typeof welcomeMessage === 'string'
        ? <Text color="cyan">{welcomeMessage}</Text>
        : welcomeMessage
    }
  ]);

  const executeCommand = async (raw: string) => {
    const { commandName } = parseCommandLine(raw);
    if (!commandName) return;

    const result = await executeCommandRaw(raw, {
      commands,
      store,
      cwd,
      setCwd,
      ...(createProgram ? { createProgram } : {}),
      ...(session !== undefined ? { session } : {}),
      ...(config !== undefined ? { config } : {}),
      ...(driver ? { driver } : {}),
      ...(connectivity ? { connectivity } : {}),
      clearScreen: () => setHistory([]),
      ...(runtime === 'terminal'
        ? {
          exit: () => {
            const nodeProcess = (globalThis as { process?: { exit?: (code?: number) => never } }).process;
            nodeProcess?.exit?.(0);
          }
        }
        : {})
    });

    if (commandName !== 'clear') {
      setHistory((prev) => [...prev, { command: `$ ${raw}`, component: result.component }]);
    }

    setInput('');
    setInputKey((prev) => prev + 1);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {history.map((item, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          {item.command ? <Text dimColor>{item.command}</Text> : null}
          {item.component && <Box marginLeft={2}>{item.component}</Box>}
        </Box>
      ))}
      <Box>
        <Text color="green">$ </Text>
        <TextInput
          key={inputKey}
          defaultValue={input}
          onChange={setInput}
          onSubmit={executeCommand}
          placeholder="Type command"
        />
      </Box>
    </Box>
  );
}

export const InteractiveShell: React.FC<{
  commands: Record<string, CommandHandler>;
  createProgram?: () => import('commander').Command;
  runtime?: 'browser' | 'terminal';
  store?: DevalboStore;
  config?: AppConfig;
  driver?: IFilesystemDriver | null;
  cwd?: string;
  setCwd?: (next: string) => void;
  session?: unknown | null;
  welcomeMessage: string | ReactNode;
}> = ({
  commands,
  createProgram,
  runtime = 'browser',
  store,
  config,
  driver = null,
  cwd,
  setCwd,
  session,
  welcomeMessage
}) => {
  const shellStore = useMemo(() => store ?? createDevalboStore(), [store]);
  const fallbackCwd = useMemo(() => {
    if (detectPlatform().platform !== RuntimePlatform.NodeJS) return '/';
    const nodeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
    return nodeProcess?.cwd?.() ?? '/';
  }, []);
  const resolvedCwd = cwd ?? fallbackCwd;
  const resolvedSetCwd = setCwd ?? (() => undefined);

  if (runtime === 'terminal') {
    return (
      <TerminalShellProvider>
        <ShellContent
          commands={commands}
          {...(createProgram ? { createProgram } : {})}
          runtime="terminal"
          store={shellStore}
          {...(config ? { config } : {})}
          driver={driver}
          cwd={resolvedCwd}
          setCwd={resolvedSetCwd}
          {...(session !== undefined ? { session } : {})}
          welcomeMessage={welcomeMessage}
        />
      </TerminalShellProvider>
    );
  }

  return (
    <BrowserShellProvider>
      <ShellContent
        commands={commands}
        {...(createProgram ? { createProgram } : {})}
        runtime="browser"
        store={shellStore}
        {...(config ? { config } : {})}
        driver={driver}
        cwd={resolvedCwd}
        setCwd={resolvedSetCwd}
        {...(session !== undefined ? { session } : {})}
        welcomeMessage={welcomeMessage}
      />
    </BrowserShellProvider>
  );
};
