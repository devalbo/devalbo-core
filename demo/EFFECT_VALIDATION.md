# Effect-Based Validation & Auto-Prompting

This project uses Effect-TS for validation with automatic prompting for missing arguments. The behavior differs based on environment:

## Behavior by Environment

### 🖥️ Terminal CLI (Interactive TTY)
When you run the CLI in a terminal:
```bash
node dist/cli.js greet
```
- **Missing args**: Prompts interactively using Ink UI
- **With args**: Uses provided values immediately

### 📟 Terminal CLI (Non-TTY/Pipes)
When run in automated scripts or tests:
```bash
echo "" | node dist/cli.js greet
```
- **Missing args**: Uses default values (e.g., "World")
- **With args**: Uses provided values

### 🌐 Browser Interactive Shell
In the browser UI at http://localhost:3000:
```
greet
```
- **Missing args**: Shows interactive prompt component
- **With args**: Uses provided values

### 🛠️ Browser Dev Console
In the browser console:
```javascript
cli.greet()
```
- **Missing args**: Uses default values (non-interactive)
- **With args**: Uses provided values

## Implementation

### 1. Validation Layer (`src/lib/validate-args.ts`)
```typescript
import { Effect, Data } from 'effect';

export class MissingArgument extends Data.TaggedError('MissingArgument')<{
  argName: string;
  message: string;
  defaultValue?: string;
}> {}

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
```

### 2. Validation Wrapper (`src/commands/with-validation.ts`)
```typescript
export const withValidation = <A>(
  validate: Effect.Effect<A, MissingArgument>,
  onSuccess: (value: A) => React.ReactNode,
  onMissingArg: (error: MissingArgument) => React.ReactNode
): CommandResult => {
  return Effect.runSync(
    Effect.matchEffect(validate, {
      onFailure: (error) => Effect.succeed({ component: onMissingArg(error) }),
      onSuccess: (value) => Effect.succeed({ component: onSuccess(value) })
    })
  );
};
```

### 3. Command Implementation (`src/commands/index.tsx`)
```typescript
greet: (args: string[], options?: CommandOptions): CommandResult => {
  // Detect environment
  const isBrowser = typeof process === 'undefined';
  const isTerminalTTY = !isBrowser && process.stdin?.isTTY;
  const shouldPrompt = isBrowser ? false : isTerminalTTY;

  return withValidation(
    validateGreetArgs(args),
    // Success: show greeting
    ({ name }) => <Text color="green">Hello, {name}!</Text>,
    // Missing arg: prompt or use default
    (error) => {
      if (!shouldPrompt && error.defaultValue) {
        return <Text color="green">Hello, {error.defaultValue}!</Text>;
      }
      return <PromptGreet promptMessage={error.message} />;
    }
  );
}
```

## Testing

### Unit Tests (`tests/unit/`)
- Test validation logic directly
- Test command success/failure paths

### BDD Terminal Tests (`tests/bdd/steps/terminal/`)
- Run with child_process.spawn to show visible output in terminal
- Capture output for assertions while displaying in real-time
- Test default value behavior in non-TTY mode
- Output is echoed to terminal during test execution

### BDD Browser Tests (`tests/bdd/steps/browser/`)
- Test interactive prompts in browser UI
- Use Playwright to interact with components

## Benefits of This Approach

1. **Type-Safe Errors**: `MissingArgument` is a typed error
2. **Composable**: Easy to add more validations
3. **Environment-Aware**: Automatic detection of TTY vs non-TTY
4. **Gradual Adoption**: Only use Effect where it adds value
5. **Testable**: Validation logic is separate and pure
6. **Clear Intent**: Error messages guide the user

## Future Extensions

Add more validation types:
```typescript
export class InvalidFormat extends Data.TaggedError('InvalidFormat')<{
  field: string;
  expected: string;
  received: string;
}> {}

export class DependencyMissing extends Data.TaggedError('DependencyMissing')<{
  dependency: string;
  installCommand?: string;
}> {}
```

Then compose validations:
```typescript
const validateCommand = Effect.gen(function* () {
  const args = yield* validateGreetArgs(rawArgs);
  const deps = yield* checkDependencies();
  const format = yield* validateFormat(args);
  return { args, deps, format };
});
```
