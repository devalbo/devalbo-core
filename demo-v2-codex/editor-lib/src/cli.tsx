import { render } from 'ink';
import { useState } from 'react';
import { createProgram } from './program';
import { commands, type CommandName } from './commands';
import { TerminalShellProvider, InteractiveShell } from '@devalbo/cli-shell';
import { createDevalboStore } from '@devalbo/state';
import { createFilesystemDriver, type IFilesystemDriver } from '@devalbo/filesystem';
import { defaultAppConfig } from './web/config';

const TERMINAL_WELCOME_MESSAGE = 'Try: pwd, ls, export ., import snapshot.bft restore, backend';

const TerminalInteractiveShell = ({
  store,
  driver
}: {
  store: ReturnType<typeof createDevalboStore>;
  driver: IFilesystemDriver;
}) => {
  const [cwd, setCwd] = useState(process.cwd());
  return (
    <InteractiveShell
      runtime="terminal"
      commands={commands}
      createProgram={createProgram}
      store={store}
      config={defaultAppConfig}
      driver={driver}
      cwd={cwd}
      setCwd={setCwd}
      welcomeMessage={TERMINAL_WELCOME_MESSAGE}
    />
  );
};

export async function setupCLI(argv?: string[]) {
  const program = createProgram();
  const parsedArgv = argv ?? process.argv;
  let cwd = process.cwd();
  let interactiveMode = false;
  const store = createDevalboStore();
  const driver = await createFilesystemDriver();

  program.commands.find((cmd) => cmd.name() === 'interactive')?.action(() => {
    interactiveMode = true;
    render(<TerminalInteractiveShell store={store} driver={driver} />);
  });

  for (const cmd of program.commands) {
    const commandName = cmd.name();
    if (commandName === 'interactive') continue;
    const handler = commands[commandName as CommandName];
    if (!handler) continue;

    cmd.action(async (...receivedArgs: unknown[]) => {
      const args = receivedArgs
        .slice(0, -1)
        .flatMap((value) => Array.isArray(value) ? value.map(String) : [String(value)]);
      const result = await handler(args, {
        cwd,
        setCwd: (nextCwd) => { cwd = nextCwd; },
        store,
        config: defaultAppConfig,
        driver
      });

      render(
        <TerminalShellProvider>{result.component}</TerminalShellProvider>
      );
    });
  }

  await program.parseAsync(parsedArgv);
  if (!interactiveMode && parsedArgv.length <= 2) {
    render(<TerminalInteractiveShell store={store} driver={driver} />);
  }
  return program;
}
