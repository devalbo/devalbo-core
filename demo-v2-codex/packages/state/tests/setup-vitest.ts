import { beforeAll, vi } from 'vitest';

const passthroughConsoleError = console.error.bind(console);

beforeAll(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  vi.spyOn(console, 'error').mockImplementation((...args: Parameters<typeof console.error>) => {
    const [firstArg] = args;
    if (typeof firstArg === 'string') {
      if (firstArg.includes('react-test-renderer is deprecated')) {
        return;
      }
      if (firstArg.includes('The current testing environment is not configured to support act(...)')) {
        return;
      }
    }
    passthroughConsoleError(...args);
  });
});
