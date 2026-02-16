import { describe, expect, it } from 'vitest';
import type { IdTypePrefixBrand, RegexableString } from '../src/core/brand-types';
import {
  createBrandedPrefixKeyStringSchema,
  createBrandedPrefixKeyStringToolbox,
  createBrandedPrefixKeyStringValue,
  isValidBrandedPrefixKeyStringValue,
  type IKeyMethodology,
} from '../src/core/prefix-key-string';
import { NumberIndexMethodBrandKey, type NumberIndexKeyValue } from '../src/methodologies/number-index-key';

const TestPrefix = 'test' as IdTypePrefixBrand;

const methodology: IKeyMethodology<typeof TestPrefix, NumberIndexKeyValue> = {
  idPrefix: TestPrefix,
  createIdPrefixRegexStr: (prefix) => prefix as unknown as RegexableString,
  keyRegexStr: '[0-9]+' as RegexableString,
  generateRandomKey: () => '123' as NumberIndexKeyValue,
};

describe('prefix-key-string', () => {
  it('creates schema and validates ids', () => {
    const schema = createBrandedPrefixKeyStringSchema(methodology, ':');
    expect(schema.safeParse('test:42').success).toBe(true);
    expect(schema.safeParse('wrong:42').success).toBe(false);
  });

  it('creates toolbox with separator', () => {
    const toolbox = createBrandedPrefixKeyStringToolbox(methodology, ':');
    expect(toolbox.separator).toBe(':');
    expect(toolbox.createRandomId).toBeDefined();
    expect(toolbox.createRandomId?.()).toBe('test:123');
  });

  it('createIdForKey is deterministic', () => {
    const toolbox = createBrandedPrefixKeyStringToolbox(methodology, ':');
    expect(toolbox.createIdForKey('7' as NumberIndexKeyValue)).toBe('test:7');
  });

  it('parseId returns success and failure safeparse results', () => {
    const toolbox = createBrandedPrefixKeyStringToolbox(methodology, ':');
    const ok = toolbox.parseId('test:12');
    expect(ok.success).toBe(true);

    const bad = toolbox.parseId('test:abc');
    expect(bad.success).toBe(false);
  });

  it('assertId throws on invalid input', () => {
    const toolbox = createBrandedPrefixKeyStringToolbox(methodology, ':');
    expect(() => toolbox.assertId('wrong:12')).toThrow();
    expect(toolbox.assertId('test:12')).toBe('test:12');
  });

  it('validates with type guard helper', () => {
    expect(
      isValidBrandedPrefixKeyStringValue(
        'test:123',
        'test' as IdTypePrefixBrand,
        '[0-9]+' as unknown as NumberIndexKeyValue,
        ':',
      ),
    ).toBe(true);
    expect(
      isValidBrandedPrefixKeyStringValue(
        'test:abc',
        'test' as IdTypePrefixBrand,
        '[0-9]+' as unknown as NumberIndexKeyValue,
        ':',
      ),
    ).toBe(false);
  });

  it('supports special separator values', () => {
    const value = createBrandedPrefixKeyStringValue(
      'prefix' as IdTypePrefixBrand,
      '::',
      '99' as unknown as NumberIndexKeyValue,
    );
    expect(value).toBe('prefix::99');
  });

  it('omits createRandomId when no random generator is provided', () => {
    const hashMethod: IKeyMethodology<typeof TestPrefix, NumberIndexKeyValue> = {
      idPrefix: TestPrefix,
      createIdPrefixRegexStr: (prefix) => prefix as unknown as RegexableString,
      keyRegexStr: '[0-9]+' as RegexableString,
    };

    const toolbox = createBrandedPrefixKeyStringToolbox(hashMethod, ':');
    expect(toolbox.createRandomId).toBeUndefined();
  });

  it('prefix and key methodology brands are distinct at type level', () => {
    expect(NumberIndexMethodBrandKey).toBe('number-index-methodology');
  });
});
