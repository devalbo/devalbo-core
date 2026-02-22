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
} from '../lib/filesystem-actions';
import {
  parseCatArgs,
  parseCdArgs,
  parseCpArgs,
  parseLsArgs,
  parseMkdirArgs,
  parseMvArgs,
  parseRmArgs,
  parseStatArgs,
  parseTouchArgs,
  parseTreeArgs
} from '../lib/filesystem-args.parser';
import type { AsyncCommandHandler } from './_util';
import { makeError, makeOutput } from './_util';

export const filesystemCommands: Record<
  'pwd' | 'cd' | 'ls' | 'tree' | 'stat' | 'cat' | 'touch' | 'mkdir' | 'cp' | 'mv' | 'rm',
  AsyncCommandHandler
> = {
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
  }
};
