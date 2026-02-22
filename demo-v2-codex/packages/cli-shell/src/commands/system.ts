import { getFilesystemBackendInfo } from '../lib/file-operations';
import type { AsyncCommandHandler } from './_util';
import { makeError, makeOutput } from './_util';

export const systemCommands: Record<'clear' | 'backend' | 'exit' | 'help', AsyncCommandHandler> = {
  clear: async (_args, options) => {
    options?.clearScreen?.();
    return makeOutput('');
  },
  backend: async () => {
    const info = await getFilesystemBackendInfo();
    const lines = [`Platform: ${info.platform}`, `Adapter: ${info.adapter}`];
    if (info.persistence) lines.push(`Persistence: ${info.persistence}`);
    if (info.baseDir) lines.push(`Base directory: ${info.baseDir}`);
    return makeOutput(lines.join('\n'));
  },
  exit: async (_args, options) => {
    if (!options?.exit) return makeError('exit is only available in terminal interactive mode');
    options.exit();
    return makeOutput('Exiting...');
  },
  help: async (_args, options) => {
    if (!options?.createProgram) {
      return makeOutput('No program registered. Pass createProgram when setting up the shell.');
    }
    const program = options.createProgram();
    const lines: string[] = [];
    lines.push(`Usage: ${program.name()} [options] [command]`);
    lines.push('');
    lines.push(program.description());
    lines.push('');
    lines.push('Commands:');
    for (const cmd of program.commands) {
      const args = cmd.registeredArguments?.map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`)).join(' ') ?? '';
      lines.push(`  ${(cmd.name() + ' ' + args).trim().padEnd(20)} ${cmd.description()}`);
    }
    return makeOutput(lines.join('\n'));
  }
};
