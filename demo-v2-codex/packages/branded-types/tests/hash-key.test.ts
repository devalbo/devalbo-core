import { describe, expect, it } from 'vitest';
import { createBrandedHashToolbox, type HashKeyValue } from '../src/methodologies/hash-key';
import type { IdTypePrefixBrand } from '../src/core/brand-types';

const HashPrefix = 'doc' as IdTypePrefixBrand;

describe('hash-key', () => {
  it('accepts valid hashes for configured length', () => {
    const toolbox8 = createBrandedHashToolbox(HashPrefix, { hashLength: 8 });
    expect(toolbox8.parseId('doc_deadbeef').success).toBe(true);

    const toolbox16 = createBrandedHashToolbox(HashPrefix, { hashLength: 16 });
    expect(toolbox16.parseId('doc_0123456789abcdef').success).toBe(true);
  });

  it('rejects wrong length and non-hex keys', () => {
    const toolbox = createBrandedHashToolbox(HashPrefix, { hashLength: 8 });
    expect(toolbox.parseId('doc_abc').success).toBe(false);
    expect(toolbox.parseId('doc_zzzzzzzz').success).toBe(false);
  });

  it('supports custom separator', () => {
    const toolbox = createBrandedHashToolbox(HashPrefix, { hashLength: 8, separator: '-' });
    const id = toolbox.createIdForKey('deadbeef' as HashKeyValue);
    expect(id).toBe('doc-deadbeef');
    expect(toolbox.parseId(id).success).toBe(true);
  });

  it('does not expose createRandomId', () => {
    const toolbox = createBrandedHashToolbox(HashPrefix, { hashLength: 8 });
    expect(toolbox.createRandomId).toBeUndefined();
  });

  it('roundtrips createIdForKey -> parse', () => {
    const toolbox = createBrandedHashToolbox(HashPrefix, { hashLength: 8 });
    const id = toolbox.createIdForKey('cafebabe' as HashKeyValue);
    const parsed = toolbox.parseId(id);
    expect(parsed.success).toBe(true);
  });

  it('rejects cross-prefix hash IDs', () => {
    const a = createBrandedHashToolbox('a' as IdTypePrefixBrand, { hashLength: 8 });
    const b = createBrandedHashToolbox('b' as IdTypePrefixBrand, { hashLength: 8 });
    const id = b.createIdForKey('deadbeef' as HashKeyValue);
    expect(a.parseId(id).success).toBe(false);
  });
});
