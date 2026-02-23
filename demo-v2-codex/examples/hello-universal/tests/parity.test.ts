import { afterEach, describe, expect, it } from 'vitest';
import {
  bindCliRuntimeSource,
  cli,
  createDevalboStore,
  createCliAppConfig,
  unbindCliRuntimeSource
} from 'devalbo-cli';
import { commands } from '../src/commands';
import { createProgram } from '../src/program';

const config = createCliAppConfig({
  appId: 'hello-universal',
  appName: 'Hello Universal',
  storageKey: 'hello-universal-store'
});

describe('hello-universal command parity', () => {
  afterEach(() => {
    unbindCliRuntimeSource();
  });

  it('registers app and built-in commands in commander metadata', () => {
    const names = createProgram().commands.map((cmd) => cmd.name());
    expect(names).toContain('hello');
    expect(names).toContain('echo');
    expect(names).toContain('pwd');
    expect(names).toContain('app-config');
  });

  it('executes app commands through shared cli runtime API', async () => {
    const store = createDevalboStore();
    let cwd = '/';
    bindCliRuntimeSource({
      getContext: () => ({
        commands,
        createProgram,
        store,
        config,
        cwd,
        setCwd: (next) => {
          cwd = next;
        }
      })
    });

    const hello = await cli.execText('hello', ['Alice']);
    const echo = await cli.execText('echo', ['foo', 'bar']);

    expect(hello.error).toBeNull();
    expect(hello.text).toContain('Hello, Alice!');
    expect(echo.error).toBeNull();
    expect(echo.text).toContain('foo bar');
  });

  it('exposes help and app-config through the same runtime', async () => {
    const store = createDevalboStore();
    bindCliRuntimeSource({
      getContext: () => ({
        commands,
        createProgram,
        store,
        config,
        cwd: '/',
        setCwd: () => undefined
      })
    });

    const help = await cli.execText('help', []);
    const appConfig = await cli.execText('app-config', []);

    expect(help.error).toBeNull();
    expect(help.text).toContain('hello');
    expect(help.text).toContain('pwd');
    expect(appConfig.error).toBeNull();
    expect(appConfig.text).toContain('appId: hello-universal');
  });
});
