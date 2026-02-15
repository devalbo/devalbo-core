import React from 'react';
import { Box, Text } from 'ink';
import { detectPlatform, RuntimePlatform, type CommandOptions, type CommandResult } from '@devalbo/shared';
import { createProgram } from '@/program';
import {
  changeDir,
  copyPath,
  getDefaultCwd,
  importBftTextToLocation,
  importBftToLocation,
  listDirectory,
  makeDirectory,
  movePath,
  readTextFile,
  removePath,
  statPath,
  touchFile,
  exportDirectoryAsBft,
  treeText
} from '@/lib/filesystem-actions';
import { getFilesystemBackendInfo } from '@/lib/file-operations';

type ExtendedCommandOptions = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
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
  | 'export'
  | 'import'
  | 'exit'
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

const defaultImportLocationFromFileName = (fileName: string): string => {
  const base = fileName.replace(/\.[^/.]+$/, '').trim();
  return base || 'imported';
};

const defaultExportFileName = (sourcePath: string): string => {
  const cleaned = sourcePath.trim().replace(/[/\\]+/g, '-').replace(/^-+|-+$/g, '');
  const base = cleaned === '' || cleaned === '.' ? 'fileroot' : cleaned;
  return `${base}.bft.json`;
};

const downloadTextFile = (fileName: string, text: string): void => {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Download is unavailable in this runtime');
  }

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const pickBftFileText = async (): Promise<{ name: string; text: string } | null> => {
  if (typeof document === 'undefined') {
    throw new Error('File picker is unavailable in this runtime');
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bft,.json,application/json';
    input.style.display = 'none';

    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();

      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        resolve({ name: file.name, text });
      } catch (err) {
        reject(err);
      }
    };

    input.oncancel = () => {
      input.remove();
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
};

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
  export: async (args, options) => {
    const sourcePath = args[0] ?? '.';
    const outputPath = args[1];
    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const platform = detectPlatform().platform;
      const result = await exportDirectoryAsBft(cwd, sourcePath, outputPath);
      if (!result.outputPath) {
        if (platform === RuntimePlatform.Browser) {
          const fileName = defaultExportFileName(sourcePath);
          downloadTextFile(fileName, result.json);
          return makeOutput(`Downloaded ${fileName}`);
        }
        return makeOutput(result.json);
      }
      return makeOutput(`Exported ${result.sourcePath} -> ${result.outputPath}`);
    } catch (err) {
      return makeError(String((err as Error).message ?? 'Export failed'));
    }
  },
  import: async (args, options) => {
    const cwd = options?.cwd ?? getDefaultCwd();
    const platform = detectPlatform().platform;

    const bftFilePath = args[0];
    const locationName = args[1];

    if (bftFilePath && locationName) {
      try {
        const result = await importBftToLocation(cwd, bftFilePath, locationName);
        return makeOutput(`Imported ${result.bftFilePath} -> ${result.targetPath}`);
      } catch (err) {
        return makeError(String((err as Error).message ?? 'Import failed'));
      }
    }

    const isPickerRuntime = platform === RuntimePlatform.Browser || platform === RuntimePlatform.Tauri;
    if (!isPickerRuntime) return makeError('Usage: import <bft-file> <location>');

    const requestedLocation = args[0];
    try {
      const picked = await pickBftFileText();
      if (!picked) return makeError('Import canceled');

      const targetLocation = requestedLocation ?? defaultImportLocationFromFileName(picked.name);
      const result = await importBftTextToLocation(cwd, picked.text, targetLocation);
      return makeOutput(`Imported ${picked.name} -> ${result.targetPath}`);
    } catch (err) {
      return makeError(String((err as Error).message ?? 'Import failed'));
    }
  },
  exit: async (_args, options) => {
    if (!options?.exit) return makeError('exit is only available in terminal interactive mode');
    options.exit();
    return makeOutput('Exiting...');
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
