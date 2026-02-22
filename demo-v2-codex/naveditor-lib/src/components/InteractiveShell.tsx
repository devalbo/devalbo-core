import { useMemo, useState, type ReactNode } from 'react';
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
import { useSolidSession } from '@devalbo/solid-client';
import type { IFilesystemDriver } from '@devalbo/filesystem';
import { executeCommandRaw, parseCommandLine } from '@/lib/command-runtime';

interface CommandOutput {
  command: string;
  component?: ReactNode;
}

function ShellContent({
  runtime,
  store,
  config,
  driver,
  cwd,
  setCwd
}: {
  runtime: 'browser' | 'terminal';
  store: DevalboStore;
  config?: AppConfig;
  driver?: IFilesystemDriver | null;
  cwd: string;
  setCwd: (next: string) => void;
}) {
  const session = useSolidSession();
  const [connectivity] = useState<IConnectivityService>(() => new BrowserConnectivityService());
  const [input, setInput] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'Welcome to naveditor',
      component: <Text color="cyan">Try: pwd, ls, export ., import snapshot.bft restore, backend</Text>
    }
  ]);

  const executeCommand = async (raw: string) => {
    const { commandName } = parseCommandLine(raw);
    if (!commandName) return;

    const result = await executeCommandRaw(raw, {
      store,
      cwd,
      setCwd,
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
          <Text dimColor>{item.command}</Text>
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
  runtime?: 'browser' | 'terminal';
  store?: DevalboStore;
  config?: AppConfig;
  driver?: IFilesystemDriver | null;
  cwd?: string;
  setCwd?: (next: string) => void;
}> = ({
  runtime = 'browser',
  store,
  config,
  driver = null,
  cwd,
  setCwd
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
          runtime="terminal"
          store={shellStore}
          {...(config ? { config } : {})}
          driver={driver}
          cwd={resolvedCwd}
          setCwd={resolvedSetCwd}
        />
      </TerminalShellProvider>
    );
  }

  return (
    <BrowserShellProvider>
      <ShellContent
        runtime="browser"
        store={shellStore}
        {...(config ? { config } : {})}
        driver={driver}
        cwd={resolvedCwd}
        setCwd={resolvedSetCwd}
      />
    </BrowserShellProvider>
  );
};
