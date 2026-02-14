import { describe, expect, it } from 'vitest';
import { ServiceContainer } from '../src/environment/inject';

describe('ServiceContainer', () => {
  it('registers and resolves services', () => {
    const container = new ServiceContainer();
    const service = { value: 42 };

    container.register('svc', service);

    expect(container.resolve<typeof service>('svc')).toBe(service);
  });

  it('throws for missing service', () => {
    const container = new ServiceContainer();
    expect(() => container.resolve('missing')).toThrow('Service not found: missing');
  });
});
