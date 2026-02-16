import { describe, expect, it } from 'vitest';
import { createBrandedUuidToolbox, type UuidKeyValue } from '../src/methodologies/uuid-key';
import type { IdTypePrefixBrand } from '../src/core/brand-types';

const GamePrefix = 'game' as IdTypePrefixBrand;
const OtherPrefix = 'other' as IdTypePrefixBrand;

const validV4 = '550e8400-e29b-41d4-a716-446655440000';
const validV4Two = 'de305d54-75b4-431b-adb2-eb6b9e546014';

describe('uuid-key', () => {
  it('accepts valid v4 UUID IDs', () => {
    const toolbox = createBrandedUuidToolbox(GamePrefix);
    expect(toolbox.parseId(`game_${validV4}`).success).toBe(true);
  });

  it('rejects invalid UUID variants and casing', () => {
    const toolbox = createBrandedUuidToolbox(GamePrefix);
    expect(toolbox.parseId('game_550e8400-e29b-11d4-a716-446655440000').success).toBe(false);
    expect(toolbox.parseId('game_550e8400-e29b-41d4-a716-44665544000').success).toBe(false);
    expect(toolbox.parseId('game_550E8400-E29B-41D4-A716-446655440000').success).toBe(false);
  });

  it('createRandomId generates valid and unique IDs', () => {
    const toolbox = createBrandedUuidToolbox(GamePrefix);
    const one = toolbox.createRandomId?.();
    const two = toolbox.createRandomId?.();
    expect(one).toBeDefined();
    expect(two).toBeDefined();
    expect(one).not.toBe(two);
    expect(toolbox.parseId(one ?? '').success).toBe(true);
  });

  it('supports custom separators', () => {
    const toolbox = createBrandedUuidToolbox(GamePrefix, '-');
    const id = toolbox.createIdForKey(validV4 as UuidKeyValue);
    expect(id).toBe(`game-${validV4}`);
    expect(toolbox.parseId(id).success).toBe(true);
  });

  it('roundtrip createIdForKey -> parse/assert', () => {
    const toolbox = createBrandedUuidToolbox(GamePrefix);
    const id = toolbox.createIdForKey(validV4Two as UuidKeyValue);
    const parsed = toolbox.parseId(id);
    expect(parsed.success).toBe(true);
    expect(toolbox.assertId(id)).toBe(id);
  });

  it('rejects other prefixes', () => {
    const toolbox = createBrandedUuidToolbox(GamePrefix);
    const other = createBrandedUuidToolbox(OtherPrefix).createIdForKey(validV4 as UuidKeyValue);
    expect(toolbox.parseId(other).success).toBe(false);
  });
});
