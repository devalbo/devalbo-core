import React from 'react';
import { render } from 'ink';
import { createProgram } from './program';
import { commands, type CommandName } from './commands';
import { TerminalShellProvider } from './components/TerminalShellProvider';
import { InteractiveShell } from './components/InteractiveShell';

export async function setupCLI(argv?: string[]) {
  const program = createProgram();
  const parsedArgv = argv ?? process.argv;
  let cwd = process.cwd();
  let interactiveMode = false;

  program.commands.find((cmd) => cmd.name() === 'interactive')?.action(() => {
    interactiveMode = true;
    render(<InteractiveShell runtime="terminal" />);
  });

  for (const cmd of program.commands) {
    const commandName = cmd.name();
    if (commandName === 'interactive') continue;
    const handler = commands[commandName as CommandName];
    if (!handler) continue;

    cmd.action(async (...receivedArgs: unknown[]) => {
      const args = receivedArgs.slice(0, cmd.registeredArguments.length).map(String);
      const result = await handler(args, { cwd, setCwd: (nextCwd) => { cwd = nextCwd; } });

      render(
        <TerminalShellProvider>{result.component}</TerminalShellProvider>
      );
    });
  }

  await program.parseAsync(parsedArgv);
  if (!interactiveMode && parsedArgv.length <= 2) {
    render(<InteractiveShell runtime="terminal" />);
  }
  return program;
}
