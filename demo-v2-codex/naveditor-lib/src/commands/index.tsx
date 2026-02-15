import React from 'react';
import { Box, Text } from 'ink';
import type { CommandOptions, CommandResult } from '@devalbo/shared';
import { createProgram } from '@/program';
import {
  changeDir,
  copyPath,
  getDefaultCwd,
  listDirectory,
  makeDirectory,
  movePath,
  readTextFile,
  removePath,
  statPath,
  touchFile,
  treeText
} from '@/lib/filesystem-actions';
import { getFilesystemBackendInfo } from '@/lib/file-operations';

type ExtendedCommandOptions = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
};

type AsyncCommandHandler = (args: string[], options?: ExtendedCommandOptions) => Promise<CommandResult>;

type CoreCommandName =
  | 'pwd'
  | 'cd'
  | 'ls'
  | 'tree'
  | 'stat'
  | 'clear'
  | 'cat'
  | 'touch'
  | 'mkdir'
  | 'cp'
  | 'mv'
  | 'rm'
  | 'backend'
  | 'help';

type AliasCommandName = 'navigate' | 'edit';
export type CommandName = CoreCommandName | AliasCommandName;

type CommandMap = Record<CommandName, AsyncCommandHandler>;

const makeOutput = (text: string): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text>{text}</Text>
    </Box>
  )
});

const makeError = (message: string): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text color="red">{message}</Text>
    </Box>
  ),
  error: message
});

const baseCommands: Record<CoreCommandName, AsyncCommandHandler> = {
  pwd: async (_args, options) => {
    const cwd = options?.cwd ?? getDefaultCwd();
    return makeOutput(cwd);
  },
  cd: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: cd <path>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const targetPath = await changeDir(cwd, requested);
      options?.setCwd?.(targetPath);
      return makeOutput(targetPath);
    } catch (err) {
      return makeError(String((err as Error).message ?? `Directory not found: ${requested}`));
    }
  },
  ls: async (args, options) => {
    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const entries = await listDirectory(cwd, args[0] ?? '.');
      const output = entries.length === 0 ? '(empty)' : entries.map((entry) => entry.isDirectory ? `${entry.name}/` : entry.name).join('\n');
      return makeOutput(output);
    } catch {
      return makeError(`Cannot list directory: ${args[0] ?? '.'}`);
    }
  },
  tree: async (args, options) => {
    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await treeText(cwd, args[0] ?? '.'));
    } catch {
      return makeError(`Cannot read directory: ${args[0] ?? '.'}`);
    }
  },
  stat: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: stat <path>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const { path, entry } = await statPath(cwd, requested);
      const mtime = entry.mtime ? entry.mtime.toISOString() : 'unknown';
      const lines = [
        `Path: ${path}`,
        `Name: ${entry.name}`,
        `Type: ${entry.isDirectory ? 'directory' : 'file'}`,
        `Size: ${entry.size} bytes`,
        `Modified: ${mtime}`
      ];
      return makeOutput(lines.join('\n'));
    } catch {
      return makeError(`Path not found: ${requested}`);
    }
  },
  clear: async (_args, options) => {
    options?.clearScreen?.();
    return makeOutput('');
  },
  cat: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: cat <file>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await readTextFile(cwd, requested));
    } catch {
      return makeError(`Cannot read file: ${requested}`);
    }
  },
  touch: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: touch <file>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await touchFile(cwd, requested));
    } catch {
      return makeError(`Cannot touch file: ${requested}`);
    }
  },
  mkdir: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: mkdir <path>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await makeDirectory(cwd, requested));
    } catch {
      return makeError(`Cannot create directory: ${requested}`);
    }
  },
  cp: async (args, options) => {
    const source = args[0];
    const dest = args[1];
    if (!source || !dest) return makeError('Usage: cp <source> <dest>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const { sourcePath, destPath } = await copyPath(cwd, source, dest);
      return makeOutput(`${sourcePath} -> ${destPath}`);
    } catch {
      return makeError(`Cannot copy: ${source} -> ${dest}`);
    }
  },
  mv: async (args, options) => {
    const source = args[0];
    const dest = args[1];
    if (!source || !dest) return makeError('Usage: mv <source> <dest>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const { sourcePath, destPath } = await movePath(cwd, source, dest);
      return makeOutput(`${sourcePath} -> ${destPath}`);
    } catch {
      return makeError(`Cannot move: ${source} -> ${dest}`);
    }
  },
  rm: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: rm <path>');

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await removePath(cwd, requested));
    } catch {
      return makeError(`Cannot remove: ${requested}`);
    }
  },
  backend: async () => {
    const info = await getFilesystemBackendInfo();
    const lines = [`Platform: ${info.platform}`, `Adapter: ${info.adapter}`];
    if (info.persistence) lines.push(`Persistence: ${info.persistence}`);
    if (info.baseDir) lines.push(`Base directory: ${info.baseDir}`);
    return makeOutput(lines.join('\n'));
  },
  help: async () => {
    const program = createProgram();
    const lines: string[] = [];

    lines.push(`Usage: ${program.name()} [options] [command]`);
    lines.push('');
    lines.push(program.description());
    lines.push('');
    lines.push('Commands:');

    for (const cmd of program.commands) {
      const args = cmd.registeredArguments?.map((arg) => arg.required ? `<${arg.name()}>` : `[${arg.name()}]`).join(' ') || '';
      lines.push(`  ${(cmd.name() + ' ' + args).trim().padEnd(20)} ${cmd.description()}`);
    }

    return makeOutput(lines.join('\n'));
  }
};

export const commands: CommandMap = {
  ...baseCommands,
  navigate: async (args, options) => baseCommands.ls(args, options),
  edit: async (args, options) => baseCommands.cat(args, options)
};
