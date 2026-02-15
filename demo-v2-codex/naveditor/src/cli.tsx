import React from 'react';
import { render } from 'ink';
import { createProgram } from './program';
import { commands, type CommandName } from './commands';
import { TerminalShellProvider } from './components/TerminalShellProvider';

export async function setupCLI(argv?: string[]) {
  const program = createProgram();
  let cwd = process.cwd();

  for (const cmd of program.commands) {
    const commandName = cmd.name() as CommandName;
    const handler = commands[commandName];
    if (!handler) continue;

    cmd.action(async (...receivedArgs: unknown[]) => {
      const args = receivedArgs.slice(0, cmd.registeredArguments.length).map(String);
      const result = await handler(args, { cwd, setCwd: (nextCwd) => { cwd = nextCwd; } });

      render(
        <TerminalShellProvider>{result.component}</TerminalShellProvider>
      );
    });
  }

  await program.parseAsync(argv ?? process.argv);
  return program;
}
