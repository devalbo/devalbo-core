import React from 'react';
import { render } from 'ink';
import { createProgram } from './program';
import { commands } from './commands';
import { TerminalShellProvider } from './components/TerminalShellProvider';

/**
 * CLI setup function that uses Ink for terminal UI
 * @param argv - Command line arguments (defaults to process.argv in Node.js)
 */
export async function setupCLI(argv?: string[]) {
  const program = createProgram();

  // Add action handlers to commands
  const greetCommand = program.commands.find(cmd => cmd.name() === 'greet');
  if (greetCommand) {
    greetCommand.action(async (nameArgs: string[], options: { interactive?: boolean }) => {
      const result = commands.greet(nameArgs, { interactive: options.interactive });
      render(result.component);
    });
  }

  const infoCommand = program.commands.find(cmd => cmd.name() === 'info');
  if (infoCommand) {
    infoCommand.action(() => {
      const result = commands.info();
      render(result.component);
    });
  }

  const countdownCommand = program.commands.find(cmd => cmd.name() === 'countdown');
  if (countdownCommand) {
    countdownCommand.action(async () => {
      const result = commands.countdown();
      // Wrap in TerminalShellProvider so Countdown can use the shell context
      const instance = render(
        <TerminalShellProvider>
          {result.component}
        </TerminalShellProvider>
      );
      await instance.waitUntilExit();
    });
  }

  const helpCommand = program.commands.find(cmd => cmd.name() === 'help');
  if (helpCommand) {
    helpCommand.action(() => {
      const result = commands.help();
      render(result.component);
    });
  }

  // Parse arguments
  if (argv) {
    await program.parseAsync(argv);
  } else {
    await program.parseAsync();
  }

  return program;
}
