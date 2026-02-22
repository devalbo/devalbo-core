import type { ReactNode } from 'react';
import type { CommandResult } from '@devalbo/shared';
import type { CommandName } from '@/commands';
import {
  executeCommand,
  executeCommandRaw,
  type CommandRuntimeContext
} from '@/lib/command-runtime';

export type CliRuntimeSource = {
  getContext: () => CommandRuntimeContext | null;
};

let runtimeSource: CliRuntimeSource | null = null;

export const bindCliRuntimeSource = (source: CliRuntimeSource): void => {
  runtimeSource = source;
};

export const unbindCliRuntimeSource = (): void => {
  runtimeSource = null;
};

export const getCliRuntimeStatus = (): { ready: boolean; missing: string[] } => {
  if (!runtimeSource) return { ready: false, missing: ['runtimeSource'] };
  const ctx = runtimeSource.getContext();
  if (!ctx) return { ready: false, missing: ['runtimeContext'] };
  return { ready: true, missing: [] };
};

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

const withCwdOverride = (ctx: CommandRuntimeContext, cwdOverride?: string): CommandRuntimeContext => {
  if (!cwdOverride) return ctx;
  return { ...ctx, cwd: cwdOverride };
};

const getContextOrThrow = (cwdOverride?: string): CommandRuntimeContext => {
  const status = getCliRuntimeStatus();
  if (!status.ready || !runtimeSource) {
    throw new Error(`CLI not ready: ${status.missing.join(', ') || 'unknown'}`);
  }
  const ctx = runtimeSource.getContext();
  if (!ctx) {
    throw new Error('CLI not ready: runtimeContext');
  }
  return withCwdOverride(ctx, cwdOverride);
};

const unwrapOrThrow = (result: CommandResult): CommandResult => {
  if (result.error) throw new Error(result.error);
  return result;
};

async function exec(commandName: string, args: string[] = [], cwdOverride?: string): Promise<CommandResult> {
  const ctx = getContextOrThrow(cwdOverride);
  const result = await executeCommand(commandName as CommandName, args, ctx);
  const commandResult = unwrapOrThrow(result);
  const text = extractText(commandResult.component);
  if (text) {
    console.log(`\n${text}\n`);
  }
  return commandResult;
}

async function execRaw(raw: string, cwdOverride?: string): Promise<CommandResult> {
  const ctx = getContextOrThrow(cwdOverride);
  const result = await executeCommandRaw(raw, ctx);
  const commandResult = unwrapOrThrow(result);
  const text = extractText(commandResult.component);
  if (text) {
    console.log(`\n${text}\n`);
  }
  return commandResult;
}

async function execText(
  commandName: string,
  args: string[] = [],
  cwdOverride?: string
): Promise<{ text: string; error: string | null }> {
  try {
    const result = await exec(commandName, args, cwdOverride);
    return {
      text: extractText(result.component),
      error: result.error ?? null
    };
  } catch (error) {
    return {
      text: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export const cli = {
  exec,
  execRaw,
  execText,
  status: getCliRuntimeStatus,
  pwd: () => exec('pwd'),
  cd: (target: string) => exec('cd', [target]),
  ls: (target = '.') => exec('ls', [target]),
  tree: (target = '.') => exec('tree', [target]),
  stat: (target: string) => exec('stat', [target]),
  clear: () => exec('clear'),
  cat: (target: string) => exec('cat', [target]),
  touch: (target: string) => exec('touch', [target]),
  mkdir: (target: string) => exec('mkdir', [target]),
  cp: (source: string, dest: string) => exec('cp', [source, dest]),
  mv: (source: string, dest: string) => exec('mv', [source, dest]),
  rm: (target: string) => exec('rm', [target]),
  backend: () => exec('backend'),
  export: (target = '.', output?: string) => exec('export', output ? [target, output] : [target]),
  import: (locationOrBftFile?: string, location?: string) =>
    exec('import', location ? [locationOrBftFile ?? '', location] : locationOrBftFile ? [locationOrBftFile] : []),
  exit: () => exec('exit'),
  help: () => exec('help'),
  helpText: async () => (await execText('help')).text
};
