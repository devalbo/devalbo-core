import { Effect, Data } from 'effect';

/**
 * Tagged error for missing command arguments
 */
export class MissingArgument extends Data.TaggedError('MissingArgument')<{
  argName: string;
  message: string;
  defaultValue?: string;
}> {}

/**
 * Validated arguments for greet command
 */
export interface GreetArgs {
  name: string;
}

/**
 * Validates greet command arguments
 * Returns Effect that either succeeds with validated args or fails with MissingArgument
 */
export const validateGreetArgs = (args: string[]): Effect.Effect<GreetArgs, MissingArgument> =>
  Effect.gen(function* () {
    const name = args.join(' ').trim();

    if (!name) {
      return yield* Effect.fail(
        new MissingArgument({
          argName: 'name',
          message: 'Who would you like to greet?',
          defaultValue: 'World'
        })
      );
    }

    return { name };
  });
