import { z } from 'zod';
import { IdTypeKeyMethodBrandSchema, type IdTypePrefixBrand, type RegexableString } from '../core/brand-types';
import {
  createBrandedPrefixKeyStringToolbox,
  type IBrandedPrefixKeyStringToolbox,
  type IKeyMethodology,
} from '../core/prefix-key-string';

export const UuidMethodBrandKey = 'uuid-methodology' as const;
export const UuidKeyValueSchema = IdTypeKeyMethodBrandSchema.brand(UuidMethodBrandKey);
export type UuidKeyValue = z.infer<typeof UuidKeyValueSchema>;

export type UuidPrefixType = IdTypePrefixBrand;

const UUID_V4_REGEX =
  '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' as RegexableString;

export const generateUuidKey = (): UuidKeyValue => crypto.randomUUID() as UuidKeyValue;

export const uuidMethodology = <T extends UuidPrefixType>(idPrefix: T): IKeyMethodology<T, UuidKeyValue> => ({
  idPrefix,
  createIdPrefixRegexStr: (prefix: T) => prefix as unknown as RegexableString,
  keyRegexStr: UUID_V4_REGEX,
  generateRandomKey: generateUuidKey,
});

export const createBrandedUuidToolbox = <T extends UuidPrefixType>(
  idPrefix: T,
  separator = '_',
): IBrandedPrefixKeyStringToolbox<T, UuidKeyValue> =>
  createBrandedPrefixKeyStringToolbox(uuidMethodology(idPrefix), separator);
