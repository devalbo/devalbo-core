import {
  addMember,
  contactToJsonLd,
  extractMembershipsFromGroupJsonLd,
  groupToJsonLd,
  jsonLdToContactRow,
  jsonLdToGroupRow,
  jsonLdToPersonaRow,
  listContacts,
  listGroups,
  listPersonas,
  personaToJsonLd,
  setContact,
  setGroup,
  setPersona
} from '@devalbo/state';
import type { ExtendedCommandOptionsWithStore } from '@devalbo/cli-shell';
import { detectPlatform, RuntimePlatform } from '@devalbo/shared';
import {
  exportDirectoryAsBft,
  getDefaultCwd,
  readTextFile,
  importBftTextToLocation,
  importBftToLocation,
  writeTextFile
} from '@devalbo/cli-shell';
import { parseExportArgs, parseImportArgs, parseSolidExportArgs, parseSolidImportArgs } from '@/lib/command-args.parser';
import type { AsyncCommandHandler } from '@devalbo/cli-shell';
import { makeError, makeOutput, makeResult, makeResultError } from '@devalbo/cli-shell';

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

const defaultSolidExportFileName = 'social-data.json';

const hasStore = (options?: unknown): options is ExtendedCommandOptionsWithStore =>
  typeof options === 'object' && options != null && 'store' in options;

type SolidBundle = {
  personas?: Array<Record<string, unknown>>;
  contacts?: Array<Record<string, unknown>>;
  groups?: Array<Record<string, unknown>>;
};

export const ioCommands: Record<'export' | 'import' | 'solid-export' | 'solid-import', AsyncCommandHandler> = {
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
  'solid-export': async (args, options) => {
    const parsed = parseSolidExportArgs(args);
    if (!parsed.success) return makeResultError(`Usage: solid-export [output]\n${parsed.error}`);
    if (!hasStore(options)) return makeResultError('solid-export requires a store in command options');

    try {
      const store = options.store;
      const personas = listPersonas(store).map(({ id, row }) => personaToJsonLd(row, id));
      const contacts = listContacts(store).map(({ id, row }) => contactToJsonLd(row, id));
      const groups = listGroups(store).map(({ id, row }) => groupToJsonLd(store, row, id));

      const bundle: Required<SolidBundle> = { personas, contacts, groups };
      const json = JSON.stringify(bundle, null, 2);
      const cwd = options.cwd ?? getDefaultCwd();
      const outputPath = parsed.value.outputPath ?? defaultSolidExportFileName;
      const writtenPath = await writeTextFile(cwd, outputPath, json);
      return makeResult(`Exported Solid JSON-LD bundle -> ${writtenPath}`, {
        outputPath: writtenPath,
        counts: { personas: personas.length, contacts: contacts.length, groups: groups.length }
      });
    } catch (err) {
      return makeResultError(String((err as Error).message ?? 'solid-export failed'));
    }
  },
  'solid-import': async (args, options) => {
    const parsed = parseSolidImportArgs(args);
    if (!parsed.success) return makeResultError(`Usage: solid-import <file>\n${parsed.error}`);
    if (!hasStore(options)) return makeResultError('solid-import requires a store in command options');

    try {
      const cwd = options.cwd ?? getDefaultCwd();
      const text = await readTextFile(cwd, parsed.value.filePath);
      const parsedJson = JSON.parse(text) as SolidBundle;

      const personas = Array.isArray(parsedJson.personas) ? parsedJson.personas : [];
      const contacts = Array.isArray(parsedJson.contacts) ? parsedJson.contacts : [];
      const groups = Array.isArray(parsedJson.groups) ? parsedJson.groups : [];

      const store = options.store;
      for (const personaJson of personas) {
        const parsedPersona = jsonLdToPersonaRow(personaJson);
        setPersona(store, parsedPersona.id, parsedPersona.row);
      }

      for (const contactJson of contacts) {
        const parsedContact = jsonLdToContactRow(contactJson);
        setContact(store, parsedContact.id, parsedContact.row);
      }

      for (const groupJson of groups) {
        const parsedGroup = jsonLdToGroupRow(groupJson);
        setGroup(store, parsedGroup.id, parsedGroup.row);
      }

      for (const groupJson of groups) {
        const memberships = extractMembershipsFromGroupJsonLd(groupJson);
        for (const membership of memberships) {
          addMember(store, membership);
        }
      }

      return makeResult(
        `Imported Solid JSON-LD bundle from ${parsed.value.filePath} ` +
        `(${personas.length} personas, ${contacts.length} contacts, ${groups.length} groups)`,
        { filePath: parsed.value.filePath, counts: { personas: personas.length, contacts: contacts.length, groups: groups.length } }
      );
    } catch (err) {
      return makeResultError(String((err as Error).message ?? 'solid-import failed'));
    }
  }
};
