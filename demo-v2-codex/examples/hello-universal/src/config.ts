import { createCliAppConfig } from 'devalbo-cli';

export const appConfig = createCliAppConfig({
  appId: 'hello-universal',
  appName: 'Hello Universal',
  storageKey: 'hello-universal-store'
});

export const welcomeMessage = 'Welcome to Hello Universal. Type "help" for available commands.';
