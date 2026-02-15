import { Command } from 'commander';

export function createProgram() {
  const program = new Command();

  program
    .name('naveditor')
    .description('Basic file terminal app')
    .version('0.1.0');

  program.command('pwd').description('Print current directory');
  program.command('cd').description('Change current directory').argument('<path>', 'Directory path');
  program.command('ls').description('List files in a directory').argument('[path]', 'Directory path', '.');
  program.command('tree').description('Show recursive directory tree').argument('[path]', 'Directory path', '.');
  program.command('stat').description('Show path metadata').argument('<path>', 'Path to inspect');
  program.command('clear').description('Clear terminal output');
  program.command('cat').description('Print file contents').argument('<file>', 'File path');
  program.command('touch').description('Create an empty file').argument('<file>', 'File path');
  program.command('mkdir').description('Create a directory').argument('<path>', 'Directory path');
  program.command('cp').description('Copy file or directory').argument('<source>', 'Source path').argument('<dest>', 'Destination path');
  program.command('mv').description('Move or rename file or directory').argument('<source>', 'Source path').argument('<dest>', 'Destination path');
  program.command('rm').description('Remove file or directory').argument('<path>', 'Path to remove');
  program.command('backend').description('Show active filesystem backend');

  program
    .command('help')
    .description('Display help for command');

  return program;
}
