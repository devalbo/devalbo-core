import React from 'react';
import { render } from 'ink';
import { createProgram } from './program';
import { commands } from './commands';
import { TerminalShellProvider } from './components/TerminalShellProvider';

export async function setupCLI(argv?: string[]) {
  const program = createProgram();

  const navigate = program.commands.find((cmd) => cmd.name() === 'navigate');
  if (navigate) {
    navigate.action((pathArg: string) => {
      const result = commands.navigate(pathArg ? [pathArg] : []);
      render(
        <TerminalShellProvider>{result.component}</TerminalShellProvider>
      );
    });
  }

  const edit = program.commands.find((cmd) => cmd.name() === 'edit');
  if (edit) {
    edit.action((file: string) => {
      const result = commands.edit([file]);
      render(
        <TerminalShellProvider>{result.component}</TerminalShellProvider>
      );
    });
  }

  const help = program.commands.find((cmd) => cmd.name() === 'help');
  if (help) {
    help.action(() => {
      const result = commands.help();
      render(result.component);
    });
  }

  await program.parseAsync(argv ?? process.argv);
  return program;
}
