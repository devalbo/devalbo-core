import { Effect } from 'effect';
import type { CommandResult } from '@devalbo/shared';
import { MissingArgument } from '@devalbo/shared';
import type { ReactNode } from 'react';

export const withValidation = <A>(
  validate: Effect.Effect<A, MissingArgument>,
  onSuccess: (value: A) => ReactNode,
  onMissingArg: (error: MissingArgument) => ReactNode
): CommandResult => {
  return Effect.runSync(
    Effect.matchEffect(validate, {
      onFailure: (error) => Effect.succeed({ component: onMissingArg(error), error: error.message }),
      onSuccess: (value) => Effect.succeed({ component: onSuccess(value) })
    })
  );
};
