import { Command } from 'commander';

export function createProgram() {
  const program = new Command();
  const collect = (value: string, previous: string[]) => [...previous, value];

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
  program.command('export').description('Export a directory as BFT JSON').argument('[path]', 'Source directory path', '.').argument('[output]', 'Output .bft/.json file path');
  program
    .command('import')
    .description('Import BFT JSON (browser/Tauri picks a file when no bftFile is provided)')
    .argument('[bftFile]', 'BFT file path')
    .argument('[location]', 'Target directory name/path');
  program
    .command('solid-export')
    .description('Export social entities as a Solid JSON-LD bundle')
    .argument('[output]', 'Output JSON file path', 'social-data.json');
  program
    .command('solid-import')
    .description('Import social entities from a Solid JSON-LD bundle file')
    .argument('<file>', 'Solid JSON-LD bundle file path');
  program.command('exit').description('Exit interactive terminal session');
  program.command('interactive').description('Start interactive terminal session');
  program
    .command('persona')
    .description('Manage personas (list, create, show, edit, delete, set-default)')
    .argument('<subcommand>')
    .argument('[args...]', '', collect, []);
  program
    .command('contact')
    .description('Manage contacts (list, add, show, edit, delete, search, link)')
    .argument('<subcommand>')
    .argument('[args...]', '', collect, []);
  program
    .command('group')
    .description('Manage groups (list, create, show, edit, delete, add-member, remove-member, list-members)')
    .argument('<subcommand>')
    .argument('[args...]', '', collect, []);

  program
    .command('help')
    .description('Display help for command');

  return program;
}
