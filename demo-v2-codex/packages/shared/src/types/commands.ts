import type React from 'react';

export interface CommandResult {
  component: React.ReactNode;
  error?: string;
}

export interface CommandOptions {
  interactive?: boolean;
  onComplete?: () => void;
}

export type CommandHandler = (args: string[], options?: CommandOptions) => CommandResult;
