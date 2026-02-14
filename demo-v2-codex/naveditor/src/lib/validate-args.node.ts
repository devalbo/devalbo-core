import { Effect } from 'effect';
import { MissingArgument } from '@devalbo/shared';
import { statSync } from 'node:fs';
import path from 'node:path';

export interface NavigateArgs {
  path: string;
}

export interface EditArgs {
  file: string;
}

export const validateNavigateArgs = (args: string[]): Effect.Effect<NavigateArgs, MissingArgument> =>
  Effect.gen(function* () {
    const requested = args[0] || '.';
    const resolved = path.resolve(requested);

    const stat = yield* Effect.try({
      try: () => statSync(resolved),
      catch: () =>
        new MissingArgument({
          argName: 'path',
          message: `Directory not found: ${requested}`,
          defaultValue: '.'
        })
    });

    if (!stat.isDirectory()) {
      return yield* Effect.fail(
        new MissingArgument({
          argName: 'path',
          message: `Not a directory: ${requested}`,
          defaultValue: '.'
        })
      );
    }

    return { path: resolved };
  });

export const validateEditArgs = (args: string[]): Effect.Effect<EditArgs, MissingArgument> =>
  Effect.gen(function* () {
    const requested = args[0]?.trim();

    if (!requested) {
      return yield* Effect.fail(
        new MissingArgument({
          argName: 'file',
          message: 'File path is required'
        })
      );
    }

    const resolved = path.resolve(requested);

    const stat = yield* Effect.try({
      try: () => statSync(resolved),
      catch: () =>
        new MissingArgument({
          argName: 'file',
          message: `File not found: ${requested}`
        })
    });

    if (!stat.isFile()) {
      return yield* Effect.fail(
        new MissingArgument({
          argName: 'file',
          message: `Not a file: ${requested}`
        })
      );
    }

    return { file: resolved };
  });
