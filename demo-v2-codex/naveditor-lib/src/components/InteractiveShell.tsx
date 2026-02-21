import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@devalbo/ui';
import { commands, type CommandName } from '@/commands';
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
import { createFilesystemDriver, type IFilesystemDriver } from '@devalbo/filesystem';

interface CommandOutput {
  command: string;
  component?: ReactNode;
}

function ShellContent({
  runtime,
  store,
  config
}: {
  runtime: 'browser' | 'terminal';
  store: DevalboStore;
  config?: AppConfig;
}) {
  const session = useSolidSession();
  const [driver, setDriver] = useState<IFilesystemDriver | undefined>(undefined);
  const [connectivity] = useState<IConnectivityService>(() => new BrowserConnectivityService());
  const [input, setInput] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [cwd, setCwd] = useState(() => {
    if (detectPlatform().platform !== RuntimePlatform.NodeJS) return '/';
    const nodeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
    return nodeProcess?.cwd?.() ?? '/';
  });
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'Welcome to naveditor',
      component: <Text color="cyan">Try: pwd, ls, export ., import snapshot.bft restore, backend</Text>
    }
  ]);

  useEffect(() => {
    let cancelled = false;
    void createFilesystemDriver().then((nextDriver) => {
      if (!cancelled) setDriver(nextDriver);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const executeCommand = async (raw: string) => {
    const parts = raw.trim().split(/\s+/);
    const commandName = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    if (!commandName) return;

    const command = commands[commandName as CommandName];
    if (!command) {
      setHistory((prev) => [
        ...prev,
        { command: `$ ${raw}`, component: <Text color="red">Command not found: {commandName}</Text> }
      ]);
      setInput('');
      setInputKey((prev) => prev + 1);
      return;
    }

    const commandOptions = {
      cwd,
      setCwd,
      clearScreen: () => setHistory([]),
      ...(runtime === 'terminal'
        ? {
          exit: () => {
            const nodeProcess = (globalThis as { process?: { exit?: (code?: number) => never } }).process;
            nodeProcess?.exit?.(0);
          }
        }
        : {})
    };

    const result = await command(args, {
      ...commandOptions,
      store,
      session,
      ...(config ? { config } : {}),
      ...(driver ? { driver } : {}),
      connectivity
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
}> = ({
  runtime = 'browser',
  store,
  config
}) => {
  const shellStore = useMemo(() => store ?? createDevalboStore(), [store]);

  if (runtime === 'terminal') {
    return (
      <TerminalShellProvider>
        <ShellContent runtime="terminal" store={shellStore} {...(config ? { config } : {})} />
      </TerminalShellProvider>
    );
  }

  return (
    <BrowserShellProvider>
      <ShellContent runtime="browser" store={shellStore} {...(config ? { config } : {})} />
    </BrowserShellProvider>
  );
};
