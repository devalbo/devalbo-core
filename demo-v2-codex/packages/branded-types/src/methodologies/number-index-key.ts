import { z } from 'zod';
import { IdTypeKeyMethodBrandSchema, type IdTypePrefixBrand, type RegexableString } from '../core/brand-types';
import {
  createBrandedPrefixKeyStringToolbox,
  type IBrandedPrefixKeyStringToolbox,
  type IKeyMethodology,
} from '../core/prefix-key-string';

export const NumberIndexMethodBrandKey = 'number-index-methodology' as const;
export const NumberIndexKeyValueSchema = IdTypeKeyMethodBrandSchema.brand(NumberIndexMethodBrandKey);
export type NumberIndexKeyValue = z.infer<typeof NumberIndexKeyValueSchema>;

export type NumberIndexPrefixType = IdTypePrefixBrand;

const NUMBER_INDEX_REGEX = '[0-9]+' as RegexableString;

export const generateNumberIndexKey = (): NumberIndexKeyValue =>
  Math.floor(Math.random() * 10_000_000).toString() as NumberIndexKeyValue;

export const numberIndexMethodology = <T extends NumberIndexPrefixType>(
  idPrefix: T,
): IKeyMethodology<T, NumberIndexKeyValue> => ({
  idPrefix,
  createIdPrefixRegexStr: (prefix: T) => prefix as unknown as RegexableString,
  keyRegexStr: NUMBER_INDEX_REGEX,
  generateRandomKey: generateNumberIndexKey,
});

export const createBrandedNumberIndexToolbox = <T extends NumberIndexPrefixType>(
  idPrefix: T,
  separator = '',
): IBrandedPrefixKeyStringToolbox<T, NumberIndexKeyValue> =>
  createBrandedPrefixKeyStringToolbox(numberIndexMethodology(idPrefix), separator);
