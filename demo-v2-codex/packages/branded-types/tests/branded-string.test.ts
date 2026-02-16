import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createBrandedStringToolbox,
  createBrandedStringToolboxForSchema,
} from '../src/core/branded-string';

describe('branded-string', () => {
  it('creates branded strings from simple toolbox', () => {
    const toolbox = createBrandedStringToolbox('Tag');
    const value = toolbox.createBrandedString('hello');
    expect(value).toBe('hello');
  });

  it('hydrates typed values from schema toolbox', () => {
    const schema = z.object({ id: z.string(), value: z.number() }).describe('Payload');
    const toolbox = createBrandedStringToolboxForSchema(schema);

    const hydrated = toolbox.hydrateFromString(JSON.stringify({ id: 'a', value: 1 }));
    expect(hydrated).toEqual({ id: 'a', value: 1 });

    const branded = toolbox.createBrandedString('payload-value');
    expect(branded).toBe('payload-value');
  });

  it('requires description on schema toolbox', () => {
    const schema = z.object({ id: z.string() });
    expect(() => createBrandedStringToolboxForSchema(schema)).toThrow('no description');
  });
});
