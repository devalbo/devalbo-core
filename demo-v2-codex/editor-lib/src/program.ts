import { Command } from 'commander';
import { registerBuiltinCommands } from '@devalbo/cli-shell';

export function createProgram() {
  const program = new Command();
  const collect = (value: string, previous: string[]) => [...previous, value];

  program
    .name('naveditor')
    .description('Basic file terminal app')
    .version('0.1.0');

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
  program
    .command('solid-fetch-profile')
    .description('Fetch a public Solid WebID profile as JSON-LD')
    .argument('<webId>', 'WebID URL');
  program
    .command('solid-login')
    .description('Authenticate with a Solid OIDC issuer')
    .argument('<issuer>', 'OIDC issuer URL');
  program
    .command('solid-logout')
    .description('Clear active Solid session');
  program
    .command('solid-whoami')
    .description('Show authenticated Solid WebID');
  program
    .command('solid-pod-push')
    .description('Push social data to your Solid POD');
  program
    .command('solid-pod-pull')
    .description('Pull social data from your Solid POD');
  program
    .command('solid-share-card')
    .description('Send your persona card to a contact inbox')
    .argument('<contactId>', 'Contact row id');
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

  registerBuiltinCommands(program);

  return program;
}
