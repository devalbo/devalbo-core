import { Command } from 'commander';

/**
 * Create and configure the Commander program
 * This is shared between CLI and browser environments
 */
export function createProgram() {
  const program = new Command();

  program
    .name('demo')
    .description('Demo CLI application following devalbo-core principles')
    .version('1.0.0');

  // Define commands (actions will be added by CLI)
  program
    .command('greet')
    .description('Greet someone')
    .argument('[name...]', 'Name to greet', [])
    .option('-i, --interactive', 'Use interactive prompts');

  program
    .command('info')
    .description('Show information about this demo');

  program
    .command('help')
    .description('Display help for command');

  return program;
}
