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
import {
  parseCatArgs,
  parseCdArgs,
  parseCpArgs,
  parseExportArgs,
  parseImportArgs,
  parseLsArgs,
  parseMkdirArgs,
  parseMvArgs,
  parseRmArgs,
  parseStatArgs,
  parseTouchArgs,
  parseTreeArgs
} from '@/lib/command-args.parser';
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

const defaultImportLocationFromPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').filter(Boolean).at(-1) ?? filePath;
  return defaultImportLocationFromFileName(fileName);
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

const promptTextInput = async (question: string): Promise<string | null> => {
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    const value = window.prompt(question);
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  const env = detectPlatform();
  if (env.platform !== RuntimePlatform.NodeJS) return null;

  const nodeProcess = (globalThis as {
    process?: {
      stdin?: { isTTY?: boolean };
      stdout?: unknown;
    };
  }).process;

  if (!nodeProcess?.stdin?.isTTY) return null;

  try {
    const readlineModuleId = 'node:readline/promises';
    const readlineModule = await import(/* @vite-ignore */ readlineModuleId);
    const processModule = (globalThis as {
      process?: {
        stdin: NodeJS.ReadStream;
        stdout: NodeJS.WriteStream;
      };
    }).process;
    if (!processModule) return null;
    const rl = readlineModule.createInterface({
      input: processModule.stdin,
      output: processModule.stdout
    });
    try {
      const answer = await rl.question(question);
      const trimmed = answer.trim();
      return trimmed === '' ? null : trimmed;
    } finally {
      rl.close();
    }
  } catch {
    return null;
  }
};

const baseCommands: Record<CoreCommandName, AsyncCommandHandler> = {
  pwd: async (_args, options) => {
    const cwd = options?.cwd ?? getDefaultCwd();
    return makeOutput(cwd);
  },
  cd: async (args, options) => {
    const parsed = parseCdArgs(args);
    if (!parsed.success) return makeError(`Usage: cd <path>\n${parsed.error}`);

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const targetPath = await changeDir(cwd, parsed.value.path);
      options?.setCwd?.(targetPath);
      return makeOutput(targetPath);
    } catch (err) {
      return makeError(String((err as Error).message ?? `Directory not found: ${parsed.value.path}`));
    }
  },
  ls: async (args, options) => {
    const parsed = parseLsArgs(args);
    if (!parsed.success) return makeError(`Usage: ls [path]\n${parsed.error}`);
    const requested = parsed.value.path ?? '.';
    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const entries = await listDirectory(cwd, requested);
      const output = entries.length === 0 ? '(empty)' : entries.map((entry) => entry.isDirectory ? `${entry.name}/` : entry.name).join('\n');
      return makeOutput(output);
    } catch {
      return makeError(`Cannot list directory: ${requested}`);
    }
  },
  tree: async (args, options) => {
    const parsed = parseTreeArgs(args);
    if (!parsed.success) return makeError(`Usage: tree [path]\n${parsed.error}`);
    const requested = parsed.value.path ?? '.';
    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await treeText(cwd, requested));
    } catch {
      return makeError(`Cannot read directory: ${requested}`);
    }
  },
  stat: async (args, options) => {
    const parsed = parseStatArgs(args);
    if (!parsed.success) return makeError(`Usage: stat <path>\n${parsed.error}`);
    const requested = parsed.value.path;

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
    const parsed = parseCatArgs(args);
    if (!parsed.success) return makeError(`Usage: cat <file>\n${parsed.error}`);
    const requested = parsed.value.file;

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await readTextFile(cwd, requested));
    } catch {
      return makeError(`Cannot read file: ${requested}`);
    }
  },
  touch: async (args, options) => {
    const parsed = parseTouchArgs(args);
    if (!parsed.success) return makeError(`Usage: touch <file>\n${parsed.error}`);
    const requested = parsed.value.file;

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await touchFile(cwd, requested));
    } catch {
      return makeError(`Cannot touch file: ${requested}`);
    }
  },
  mkdir: async (args, options) => {
    const parsed = parseMkdirArgs(args);
    if (!parsed.success) return makeError(`Usage: mkdir <path>\n${parsed.error}`);
    const requested = parsed.value.path;

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      return makeOutput(await makeDirectory(cwd, requested));
    } catch {
      return makeError(`Cannot create directory: ${requested}`);
    }
  },
  cp: async (args, options) => {
    const parsed = parseCpArgs(args);
    if (!parsed.success) return makeError(`Usage: cp <source> <dest>\n${parsed.error}`);

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const { sourcePath, destPath } = await copyPath(cwd, parsed.value.source, parsed.value.dest);
      return makeOutput(`${sourcePath} -> ${destPath}`);
    } catch {
      return makeError(`Cannot copy: ${parsed.value.source} -> ${parsed.value.dest}`);
    }
  },
  mv: async (args, options) => {
    const parsed = parseMvArgs(args);
    if (!parsed.success) return makeError(`Usage: mv <source> <dest>\n${parsed.error}`);

    try {
      const cwd = options?.cwd ?? getDefaultCwd();
      const { sourcePath, destPath } = await movePath(cwd, parsed.value.source, parsed.value.dest);
      return makeOutput(`${sourcePath} -> ${destPath}`);
    } catch {
      return makeError(`Cannot move: ${parsed.value.source} -> ${parsed.value.dest}`);
    }
  },
  rm: async (args, options) => {
    const parsed = parseRmArgs(args);
    if (!parsed.success) return makeError(`Usage: rm <path>\n${parsed.error}`);
    const requested = parsed.value.path;

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
    const parsed = parseExportArgs(args);
    if (!parsed.success) return makeError(`Usage: export [path] [output]\n${parsed.error}`);
    const sourcePath = parsed.value.sourcePath ?? '.';
    const outputPath = parsed.value.outputPath;
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

    const parsed = parseImportArgs(args);
    if (!parsed.success) return makeError(`Usage: import [bft-file] [location]\n${parsed.error}`);
    const firstArg = parsed.value.firstArg;
    const secondArg = parsed.value.secondArg;
    const isPickerRuntime = platform === RuntimePlatform.Browser || platform === RuntimePlatform.Tauri;

    if (firstArg && secondArg) {
      try {
        const result = await importBftToLocation(cwd, firstArg, secondArg);
        return makeOutput(`Imported ${result.bftFilePath} -> ${result.targetPath}`);
      } catch (err) {
        return makeError(String((err as Error).message ?? 'Import failed'));
      }
    }

    if (isPickerRuntime) {
      const requestedLocation = secondArg ?? firstArg;
      try {
        const picked = await pickBftFileText();
        if (!picked) return makeError('Import canceled');

        const targetLocation = requestedLocation ?? defaultImportLocationFromFileName(picked.name);
        const result = await importBftTextToLocation(cwd, picked.text, targetLocation);
        return makeOutput(`Imported ${picked.name} -> ${result.targetPath}`);
      } catch (err) {
        return makeError(String((err as Error).message ?? 'Import failed'));
      }
    }

    let bftFilePath = firstArg;
    if (!bftFilePath) {
      const promptedPath = await promptTextInput('BFT file path: ');
      if (!promptedPath) return makeError('Usage: import [bft-file] [location]');
      bftFilePath = promptedPath;
    }

    let locationName = secondArg;
    if (!locationName) {
      const suggested = defaultImportLocationFromPath(bftFilePath);
      const entered = await promptTextInput(`Import location (default: ${suggested}): `);
      locationName = entered ?? suggested;
    }

    try {
      const result = await importBftToLocation(cwd, bftFilePath, locationName);
      return makeOutput(`Imported ${result.bftFilePath} -> ${result.targetPath}`);
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
