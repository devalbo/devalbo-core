import { startInteractiveCli } from 'devalbo-cli';
import { commands } from './commands';
import { createProgram } from './program';
import { appConfig, welcomeMessage } from './config';

await startInteractiveCli({
  commands,
  createProgram,
  config: appConfig,
  welcomeMessage
});
