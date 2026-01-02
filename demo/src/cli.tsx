import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { commands } from './commands';

/**
 * CLI setup function that uses Ink for terminal UI
 * @param argv - Command line arguments (defaults to process.argv in Node.js)
 */
export async function setupCLI(argv?: string[]) {
  const program = new Command();

  program
    .name('demo')
    .description('Demo CLI application following devalbo-core principles')
    .version('1.0.0');

  // Greet command with Ink UI
  program
    .command('greet')
    .description('Greet someone')
    .argument('[name...]', 'Name to greet', [])
    .option('-i, --interactive', 'Use interactive prompts')
    .action(async (nameArgs: string[], options: { interactive?: boolean }) => {
      // Use shared command handler with Ink-based prompts
      const result = commands.greet(nameArgs, { interactive: options.interactive });
      render(result.component);
    });

  // Info command with Ink UI
  program
    .command('info')
    .description('Show information about this demo')
    .action(() => {
      const result = commands.info();
      render(result.component);
    });

  // Parse arguments
  if (argv) {
    await program.parseAsync(argv);
  } else {
    await program.parseAsync();
  }

  return program;
}
