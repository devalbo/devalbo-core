import { z } from 'zod';
import { IdTypeKeyMethodBrandSchema, type IdTypePrefixBrand, type RegexableString } from '../core/brand-types';
import {
  createBrandedPrefixKeyStringToolbox,
  type IBrandedPrefixKeyStringToolbox,
  type IKeyMethodology,
} from '../core/prefix-key-string';

export const HashMethodBrandKey = 'hash-methodology' as const;
export const HashKeyValueSchema = IdTypeKeyMethodBrandSchema.brand(HashMethodBrandKey);
export type HashKeyValue = z.infer<typeof HashKeyValueSchema>;

export type HashPrefixType = IdTypePrefixBrand;

export interface HashMethodologyOptions {
  hashLength?: number;
}

export const hashMethodology = <T extends HashPrefixType>(
  idPrefix: T,
  options: HashMethodologyOptions = {},
): IKeyMethodology<T, HashKeyValue> => {
  const hashLength = options.hashLength ?? 8;
  const keyRegexStr = `[0-9a-f]{${hashLength}}` as RegexableString;

  return {
    idPrefix,
    createIdPrefixRegexStr: (prefix: T) => prefix as unknown as RegexableString,
    keyRegexStr,
  };
};

export const createBrandedHashToolbox = <T extends HashPrefixType>(
  idPrefix: T,
  options: { hashLength: number; separator?: string },
): IBrandedPrefixKeyStringToolbox<T, HashKeyValue> => {
  const separator = options.separator ?? '_';
  return createBrandedPrefixKeyStringToolbox(hashMethodology(idPrefix, options), separator);
};
