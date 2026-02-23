import { render } from 'ink';
import { useState } from 'react';
import React from 'react';
import type { Command } from 'commander';
import type { CommandHandler } from './commands/_util';
import type { AppConfig } from '@devalbo/shared';
import { createDevalboStore } from '@devalbo/state';
import { createFilesystemDriver } from '@devalbo/filesystem';
import { InteractiveShell } from './components/InteractiveShell';
import type { ReactNode } from 'react';

export type CliEntryOptions = {
  commands: Record<string, CommandHandler>;
  createProgram: () => Command;
  config: AppConfig;
  welcomeMessage: string | ReactNode;
};

export async function startInteractiveCli(opts: CliEntryOptions): Promise<void> {
  const store = createDevalboStore();
  const driver = await createFilesystemDriver();
  const initialCwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd?.() ?? '/';

  const App = () => {
    const [cwd, setCwd] = useState(initialCwd);
    return (
      <InteractiveShell
        runtime="terminal"
        commands={opts.commands}
        createProgram={opts.createProgram}
        store={store}
        config={opts.config}
        driver={driver}
        cwd={cwd}
        setCwd={setCwd}
        welcomeMessage={opts.welcomeMessage}
      />
    );
  };

  render(<App />);
}
