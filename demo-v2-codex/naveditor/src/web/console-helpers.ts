import type { ReactNode } from 'react';
import { commands, type CommandName } from '@/commands';

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

function exec(commandName: string, args: string[] = []) {
  const command = commands[commandName as CommandName];
  if (!command) {
    throw new Error(`Command not found: ${commandName}`);
  }

  const result = command(args);
  const text = extractText(result.component);
  if (text) {
    console.log(`\n${text}\n`);
  }

  return result;
}

export const cli = {
  exec,
  navigate: (path = '.') => exec('navigate', [path]),
  edit: (file: string) => exec('edit', [file]),
  help: () => exec('help')
};
