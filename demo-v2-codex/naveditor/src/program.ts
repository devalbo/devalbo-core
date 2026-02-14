import { Command } from 'commander';

export function createProgram() {
  const program = new Command();

  program
    .name('naveditor')
    .description('Navigator/Editor PoC')
    .version('0.1.0');

  program
    .command('navigate')
    .description('Navigate a directory')
    .argument('[path]', 'Directory to navigate', '.');

  program
    .command('edit')
    .description('Edit a file')
    .argument('<file>', 'File path to open');

  program
    .command('help')
    .description('Display help for command');

  return program;
}
