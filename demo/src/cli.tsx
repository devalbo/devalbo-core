import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import * as clack from '@clack/prompts';
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
    .argument('[name]', 'Name to greet', 'World')
    .option('-i, --interactive', 'Use interactive prompts')
    .action(async (name: string, options: { interactive?: boolean }) => {
      let finalName = name;

      if (options.interactive) {
        clack.intro('Demo Greeter');

        const nameInput = await clack.text({
          message: 'Who would you like to greet?',
          placeholder: 'World',
          initialValue: name !== 'World' ? name : '',
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Name cannot be empty';
            }
          }
        });

        if (clack.isCancel(nameInput)) {
          clack.cancel('Operation cancelled');
          process.exit(0);
        }

        finalName = nameInput as string;
        clack.outro('Done!');
      }

      // Use shared command handler
      const result = commands.greet([finalName]);
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
