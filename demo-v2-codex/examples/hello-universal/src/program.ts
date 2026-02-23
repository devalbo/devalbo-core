import { Command } from 'commander';
import { registerBuiltinCommands } from 'devalbo-cli';

export const createProgram = (): Command => {
  const program = new Command('hello-universal')
    .description('Hello world across terminal and browser')
    .version('0.1.0');

  program.command('hello [name]').description('Say hello');
  program.command('echo <words...>').description('Echo arguments');

  registerBuiltinCommands(program);
  return program;
};
