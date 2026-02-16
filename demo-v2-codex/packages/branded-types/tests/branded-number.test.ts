import { describe, expect, it } from 'vitest';
import {
  createBrandedFiniteNumberSchema,
  createBrandedIntSchema,
  createBrandedNonNegativeIntSchema,
  createBrandedPositiveIntSchema,
} from '../src/numeric/branded-number';

describe('branded-number', () => {
  it('createBrandedIntSchema accepts ints and rejects floats/non-finite', () => {
    const schema = createBrandedIntSchema('Int');
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(1.1).success).toBe(false);
    expect(schema.safeParse(Number.NaN).success).toBe(false);
    expect(schema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  it('createBrandedNonNegativeIntSchema enforces non-negative ints', () => {
    const schema = createBrandedNonNegativeIntSchema('Count');
    expect(schema.safeParse(0).success).toBe(true);
    expect(schema.safeParse(5).success).toBe(true);
    expect(schema.safeParse(-1).success).toBe(false);
  });

  it('createBrandedFiniteNumberSchema enforces finite numbers', () => {
    const schema = createBrandedFiniteNumberSchema('Finite');
    expect(schema.safeParse(1.25).success).toBe(true);
    expect(schema.safeParse(Number.NEGATIVE_INFINITY).success).toBe(false);
    expect(schema.safeParse(Number.NaN).success).toBe(false);
  });

  it('createBrandedPositiveIntSchema enforces positive ints', () => {
    const schema = createBrandedPositiveIntSchema('Positive');
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse(-1).success).toBe(false);
  });

  it('handles edge cases', () => {
    const intSchema = createBrandedIntSchema('EdgeInt');
    expect(intSchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true);
    expect(intSchema.safeParse(-0).success).toBe(true);
    expect(intSchema.safeParse(1e-8).success).toBe(false);
  });
});
