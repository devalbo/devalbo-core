import { describe, expect, it } from 'vitest';
import { createBrandedNumberIndexToolbox, type NumberIndexKeyValue } from '../src/methodologies/number-index-key';
import type { IdTypePrefixBrand } from '../src/core/brand-types';

const SeatPrefix = 'seat' as IdTypePrefixBrand;
const OtherPrefix = 'row' as IdTypePrefixBrand;

describe('number-index-key', () => {
  it('accepts valid numeric keys', () => {
    const toolbox = createBrandedNumberIndexToolbox(SeatPrefix);
    for (const value of ['0', '1', '42', '9999999']) {
      expect(toolbox.parseId(`seat${value}`).success).toBe(true);
    }
  });

  it('rejects non-numeric keys', () => {
    const toolbox = createBrandedNumberIndexToolbox(SeatPrefix);
    expect(toolbox.parseId('seata').success).toBe(false);
    expect(toolbox.parseId('seat-1').success).toBe(false);
    expect(toolbox.parseId('seat1.5').success).toBe(false);
  });

  it('supports random ID generation', () => {
    const toolbox = createBrandedNumberIndexToolbox(SeatPrefix);
    const id = toolbox.createRandomId?.();
    expect(id).toBeDefined();
    expect(toolbox.parseId(id ?? '').success).toBe(true);
  });

  it('supports custom separator', () => {
    const toolbox = createBrandedNumberIndexToolbox(SeatPrefix, '_');
    const id = toolbox.createIdForKey('42' as NumberIndexKeyValue);
    expect(id).toBe('seat_42');
    expect(toolbox.parseId(id).success).toBe(true);
  });

  it('roundtrips create -> parse -> assert', () => {
    const toolbox = createBrandedNumberIndexToolbox(SeatPrefix);
    const id = toolbox.createIdForKey('1234' as NumberIndexKeyValue);
    expect(toolbox.parseId(id).success).toBe(true);
    expect(toolbox.assertId(id)).toBe(id);
  });

  it('rejects cross-prefix IDs', () => {
    const seat = createBrandedNumberIndexToolbox(SeatPrefix);
    const row = createBrandedNumberIndexToolbox(OtherPrefix);
    const id = row.createIdForKey('4' as NumberIndexKeyValue);
    expect(seat.parseId(id).success).toBe(false);
  });
});
