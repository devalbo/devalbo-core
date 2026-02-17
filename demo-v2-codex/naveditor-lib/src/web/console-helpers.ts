import type { ReactNode } from 'react';
import { commands, type CommandName } from '@/commands';
import { createDevalboStore } from '@devalbo/state';

const store = createDevalboStore();

function extractText(node: ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    if (props?.children) return extractText(props.children);
  }
  return '';
}

async function exec(commandName: string, args: string[] = [], cwd = '/') {
  const command = commands[commandName as CommandName];
  if (!command) {
    throw new Error(`Command not found: ${commandName}`);
  }

  const result = await command(args, { cwd, store });
  const text = extractText(result.component);
  if (text) {
    console.log(`\n${text}\n`);
  }

  return result;
}

async function execText(commandName: string, args: string[] = [], cwd = '/') {
  const result = await exec(commandName, args, cwd);
  return {
    text: extractText(result.component),
    error: result.error ?? null
  };
}

export const cli = {
  exec,
  execText,
  pwd: () => exec('pwd'),
  cd: (target: string) => exec('cd', [target]),
  ls: (target = '.') => exec('ls', [target]),
  tree: (target = '.') => exec('tree', [target]),
  stat: (target: string) => exec('stat', [target]),
  clear: () => exec('clear'),
  cat: (target: string) => exec('cat', [target]),
  touch: (target: string) => exec('touch', [target]),
  mkdir: (target: string) => exec('mkdir', [target]),
  cp: (source: string, dest: string) => exec('cp', [source, dest]),
  mv: (source: string, dest: string) => exec('mv', [source, dest]),
  rm: (target: string) => exec('rm', [target]),
  backend: () => exec('backend'),
  export: (target = '.', output?: string) => exec('export', output ? [target, output] : [target]),
  import: (locationOrBftFile?: string, location?: string) =>
    exec('import', location ? [locationOrBftFile ?? '', location] : locationOrBftFile ? [locationOrBftFile] : []),
  exit: () => exec('exit'),
  help: () => exec('help'),
  helpText: async () => (await execText('help')).text
};
