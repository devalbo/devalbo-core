import { Effect } from 'effect';
import { MissingArgument } from '@devalbo/shared';

export interface NavigateArgs {
  path: string;
}

export interface EditArgs {
  file: string;
}

export const validateNavigateArgs = (args: string[]): Effect.Effect<NavigateArgs, MissingArgument> =>
  Effect.gen(function* () {
    const requested = args[0] || '.';
    return { path: requested };
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

    return { file: requested };
  });
