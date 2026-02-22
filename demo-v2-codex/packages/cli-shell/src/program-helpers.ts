import type { Command } from 'commander';
import type { AppConfig } from '@devalbo/shared';

/**
 * Register all built-in cli-shell commands on a commander program.
 *
 * Call this after registering your own app-specific commands so that
 * `help` displays everything. Built-in commands include filesystem
 * operations, system commands, and app-config.
 */
export const registerBuiltinCommands = (program: Command): void => {
  // Filesystem
  program.command('pwd').description('Print working directory');
  program.command('cd <path>').description('Change directory');
  program.command('ls [path]').description('List directory contents');
  program.command('tree [path]').description('Show directory tree');
  program.command('cat <file>').description('Display file contents');
  program.command('touch <file>').description('Create empty file');
  program.command('mkdir <dir>').description('Create directory');
  program.command('cp <src> <dest>').description('Copy file or directory');
  program.command('mv <src> <dest>').description('Move/rename file or directory');
  program.command('rm <path>').description('Remove file or directory');
  program.command('stat <path>').description('Show file/directory info');

  // System
  program.command('clear').description('Clear terminal');
  program.command('backend').description('Show filesystem backend info');
  program.command('exit').description('Exit the shell');
  program.command('help').description('Show available commands');

  // App
  program.command('app-config').description('Show current app configuration');
};

/**
 * Generate a default shell welcome message from AppConfig.
 *
 * Output format: `Welcome to <name>. Type "help" for available commands.`
 */
export const defaultWelcomeMessage = (config?: Pick<AppConfig, 'appName' | 'appId'>): string => {
  const name = config?.appName ?? config?.appId ?? 'CLI shell';
  return `Welcome to ${name}. Type "help" for available commands.`;
};
