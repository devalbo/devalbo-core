import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import type { CommandOptions, CommandResult } from '@devalbo/shared';
import { asDirectoryPath, asFilePath, detectPlatform, RuntimePlatform } from '@devalbo/shared';
import { createProgram } from '@/program';
import { getDriver } from '@/lib/file-operations';

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

const isNode = () => detectPlatform().platform === RuntimePlatform.NodeJS;
const pathOps = () => isNode() ? path : path.posix;
const defaultCwd = () => (isNode() ? process.cwd() : '/');

const toFilePath = (targetPath: string) => asFilePath(targetPath);
const toDirectoryPath = (targetPath: string) => asDirectoryPath(targetPath);

const resolvePath = (cwd: string, input = '.'): string => {
  const ops = pathOps();
  return isNode() ? ops.resolve(cwd, input) : ops.normalize(input.startsWith('/') ? input : ops.join(cwd, input));
};

const joinPath = (left: string, right: string): string => pathOps().join(left, right);
const basename = (targetPath: string): string => pathOps().basename(targetPath);

const removeRecursive = async (targetPath: string): Promise<void> => {
  const driver = await getDriver();
  const entry = await driver.stat(toFilePath(targetPath));
  if (entry.isDirectory) {
    const children = await driver.readdir(toDirectoryPath(targetPath));
    for (const child of children) {
      await removeRecursive(joinPath(targetPath, child.name));
    }
  }
  await driver.rm(toFilePath(targetPath));
};

const copyRecursive = async (sourcePath: string, destPath: string): Promise<void> => {
  const driver = await getDriver();
  const source = await driver.stat(toFilePath(sourcePath));

  if (source.isDirectory) {
    await driver.mkdir(toDirectoryPath(destPath));
    const children = await driver.readdir(toDirectoryPath(sourcePath));
    for (const child of children) {
      await copyRecursive(joinPath(sourcePath, child.name), joinPath(destPath, child.name));
    }
    return;
  }

  const data = await driver.readFile(toFilePath(sourcePath));
  await driver.writeFile(toFilePath(destPath), data);
};

const baseCommands: Record<CoreCommandName, AsyncCommandHandler> = {
  pwd: async (_args, options) => {
    const cwd = options?.cwd ?? defaultCwd();
    return makeOutput(cwd);
  },
  cd: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: cd <path>');

    const cwd = options?.cwd ?? defaultCwd();
    const targetPath = resolvePath(cwd, requested);
    const driver = await getDriver();

    try {
      const entry = await driver.stat(toFilePath(targetPath));
      if (!entry.isDirectory) return makeError(`Not a directory: ${requested}`);
      options?.setCwd?.(targetPath);
      return makeOutput(targetPath);
    } catch {
      return makeError(`Directory not found: ${requested}`);
    }
  },
  ls: async (args, options) => {
    const cwd = options?.cwd ?? defaultCwd();
    const targetPath = resolvePath(cwd, args[0] ?? '.');
    const driver = await getDriver();

    try {
      const entries = await driver.readdir(toDirectoryPath(targetPath));
      const sorted = entries.slice().sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      const output = sorted.length === 0 ? '(empty)' : sorted.map((entry) => entry.isDirectory ? `${entry.name}/` : entry.name).join('\n');
      return makeOutput(output);
    } catch {
      return makeError(`Cannot list directory: ${args[0] ?? '.'}`);
    }
  },
  tree: async (args, options) => {
    const cwd = options?.cwd ?? defaultCwd();
    const rootPath = resolvePath(cwd, args[0] ?? '.');
    const driver = await getDriver();
    const lines: string[] = [];

    const walk = async (dirPath: string, prefix: string): Promise<void> => {
      const entries = (await driver.readdir(toDirectoryPath(dirPath))).slice().sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      for (const [index, entry] of entries.entries()) {
        const isLast = index === entries.length - 1;
        const branch = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${branch}${entry.name}${entry.isDirectory ? '/' : ''}`);
      }

      for (const [index, entry] of entries.entries()) {
        if (!entry.isDirectory) continue;
        const isLast = index === entries.length - 1;
        const nextPrefix = `${prefix}${isLast ? '    ' : '│   '}`;
        await walk(joinPath(dirPath, entry.name), nextPrefix);
      }
    };

    try {
      const root = await driver.stat(toFilePath(rootPath));
      if (!root.isDirectory) return makeError(`Not a directory: ${args[0] ?? '.'}`);

      lines.push(`${basename(rootPath) || rootPath}/`);
      await walk(rootPath, '');
      return makeOutput(lines.join('\n'));
    } catch {
      return makeError(`Cannot read directory: ${args[0] ?? '.'}`);
    }
  },
  stat: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: stat <path>');

    const cwd = options?.cwd ?? defaultCwd();
    const targetPath = resolvePath(cwd, requested);
    const driver = await getDriver();

    try {
      const entry = await driver.stat(toFilePath(targetPath));
      const mtime = entry.mtime ? entry.mtime.toISOString() : 'unknown';
      const lines = [
        `Path: ${targetPath}`,
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

    const cwd = options?.cwd ?? defaultCwd();
    const filePath = resolvePath(cwd, requested);
    const driver = await getDriver();

    try {
      const entry = await driver.stat(toFilePath(filePath));
      if (entry.isDirectory) return makeError(`Not a file: ${requested}`);
      const data = await driver.readFile(toFilePath(filePath));
      return makeOutput(new TextDecoder().decode(data));
    } catch {
      return makeError(`Cannot read file: ${requested}`);
    }
  },
  touch: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: touch <file>');

    const cwd = options?.cwd ?? defaultCwd();
    const filePath = resolvePath(cwd, requested);
    const driver = await getDriver();

    try {
      const exists = await driver.exists(toFilePath(filePath));
      if (exists) {
        const entry = await driver.stat(toFilePath(filePath));
        if (entry.isDirectory) return makeError(`Not a file: ${requested}`);
      }
      await driver.writeFile(toFilePath(filePath), new Uint8Array());
      return makeOutput(filePath);
    } catch {
      return makeError(`Cannot touch file: ${requested}`);
    }
  },
  mkdir: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: mkdir <path>');

    const cwd = options?.cwd ?? defaultCwd();
    const dirPath = resolvePath(cwd, requested);
    const driver = await getDriver();

    try {
      await driver.mkdir(toDirectoryPath(dirPath));
      return makeOutput(dirPath);
    } catch {
      return makeError(`Cannot create directory: ${requested}`);
    }
  },
  cp: async (args, options) => {
    const source = args[0];
    const dest = args[1];
    if (!source || !dest) return makeError('Usage: cp <source> <dest>');

    const cwd = options?.cwd ?? defaultCwd();
    const sourcePath = resolvePath(cwd, source);
    const destPath = resolvePath(cwd, dest);

    try {
      await copyRecursive(sourcePath, destPath);
      return makeOutput(`${sourcePath} -> ${destPath}`);
    } catch {
      return makeError(`Cannot copy: ${source} -> ${dest}`);
    }
  },
  mv: async (args, options) => {
    const source = args[0];
    const dest = args[1];
    if (!source || !dest) return makeError('Usage: mv <source> <dest>');

    const cwd = options?.cwd ?? defaultCwd();
    const sourcePath = resolvePath(cwd, source);
    const destPath = resolvePath(cwd, dest);

    try {
      await copyRecursive(sourcePath, destPath);
      await removeRecursive(sourcePath);
      return makeOutput(`${sourcePath} -> ${destPath}`);
    } catch {
      return makeError(`Cannot move: ${source} -> ${dest}`);
    }
  },
  rm: async (args, options) => {
    const requested = args[0];
    if (!requested) return makeError('Usage: rm <path>');

    const cwd = options?.cwd ?? defaultCwd();
    const targetPath = resolvePath(cwd, requested);

    try {
      await removeRecursive(targetPath);
      return makeOutput(targetPath);
    } catch {
      return makeError(`Cannot remove: ${requested}`);
    }
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
