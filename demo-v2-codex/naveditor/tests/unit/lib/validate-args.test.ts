import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNavigateArgs, validateEditArgs } from '@/lib/validate-args.node';

const FIXTURES = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../fixtures');

describe('validateNavigateArgs', () => {
  it('returns resolved directory for valid path', async () => {
    const result = await Effect.runPromise(validateNavigateArgs(['.']));
    expect(result.path).toBe(path.resolve('.'));
  });

  it('defaults to current directory for empty args', async () => {
    const result = await Effect.runPromise(validateNavigateArgs([]));
    expect(result.path).toBe(path.resolve('.'));
  });

  it('fails for non-existent directory', async () => {
    const exit = await Effect.runPromiseExit(validateNavigateArgs(['./definitely-missing-dir-xyz']));
    expect(exit._tag).toBe('Failure');
  });
});

describe('validateEditArgs', () => {
  it('returns resolved file path for valid file', async () => {
    const result = await Effect.runPromise(validateEditArgs([path.join(FIXTURES, 'sample-files/hello.txt')]));
    expect(result.file.endsWith('tests/fixtures/sample-files/hello.txt')).toBe(true);
  });

  it('fails for empty args', async () => {
    const exit = await Effect.runPromiseExit(validateEditArgs([]));
    expect(exit._tag).toBe('Failure');
  });

  it('fails when path points to directory', async () => {
    const exit = await Effect.runPromiseExit(validateEditArgs([path.join(FIXTURES, 'sample-project')]));
    expect(exit._tag).toBe('Failure');
  });

  it('allows non-existent file path for create flow', async () => {
    const result = await Effect.runPromise(validateEditArgs([path.join(FIXTURES, 'sample-files/new-file.txt')]));
    expect(result.file.endsWith('tests/fixtures/sample-files/new-file.txt')).toBe(true);
  });
});
