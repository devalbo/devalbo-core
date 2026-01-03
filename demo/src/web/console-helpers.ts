import { ReactNode } from 'react';
import { commands, CommandName, CommandOptions } from '../commands';

/**
 * Extract text content from React elements for console display
 */
function extractText(node: ReactNode): string {
  if (!node) return '';

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object' && 'props' in node) {
    const props = (node as any).props;

    // Handle Text components and extract their children
    if (props && props.children) {
      return extractText(props.children);
    }
  }

  return '';
}

/**
 * Execute a command and display the result in the console
 */
function exec(commandName: string, args: string[] = [], options?: CommandOptions) {
  const command = commands[commandName as CommandName];

  if (!command) {
    console.error(`❌ Command not found: ${commandName}`);
    console.log('Available commands:', Object.keys(commands).join(', '));
    return null;
  }

  const result = command(args, options);

  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    return result;
  }

  // Extract and display text content
  const text = extractText(result.component);
  if (text) {
    console.log(`\n${text}\n`);
  }

  return result;
}

/**
 * CLI interface for browser console
 */
export const cli = {
  // Direct command access
  ...commands,

  // Helper to execute and display
  exec,

  // Convenience methods (non-interactive by default for console)
  greet: (name?: string) => {
    return exec('greet', name ? [name] : []);
  },

  info: () => exec('info'),
  help: () => exec('help'),
  loading: () => exec('loading'),
};
