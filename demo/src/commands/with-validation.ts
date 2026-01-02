import { Effect } from 'effect';
import { MissingArgument } from '../lib/validate-args';
import { CommandResult } from './index';

/**
 * Wrapper that handles validation errors by providing interactive prompts
 *
 * @param validate - Effect that validates command arguments
 * @param onSuccess - Render function called with validated data
 * @param onMissingArg - Render function called when argument is missing (for prompting)
 * @returns CommandResult with component
 */
export const withValidation = <A>(
  validate: Effect.Effect<A, MissingArgument>,
  onSuccess: (value: A) => React.ReactNode,
  onMissingArg: (error: MissingArgument) => React.ReactNode
): CommandResult => {
  return Effect.runSync(
    Effect.matchEffect(validate, {
      onFailure: (error) => {
        if (error._tag === 'MissingArgument') {
          return Effect.succeed({ component: onMissingArg(error) });
        }
        return Effect.succeed({ component: onMissingArg(error), error: error.message });
      },
      onSuccess: (value) => Effect.succeed({ component: onSuccess(value) })
    })
  );
};
