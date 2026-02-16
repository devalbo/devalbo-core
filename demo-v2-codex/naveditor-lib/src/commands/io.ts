import { detectPlatform, RuntimePlatform } from '@devalbo/shared';
import {
  exportDirectoryAsBft,
  getDefaultCwd,
  importBftTextToLocation,
  importBftToLocation
} from '@/lib/filesystem-actions';
import { parseExportArgs, parseImportArgs } from '@/lib/command-args.parser';
import type { AsyncCommandHandler } from './_util';
import { makeError, makeOutput } from './_util';

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

export const ioCommands: Record<'export' | 'import', AsyncCommandHandler> = {
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
  }
};
