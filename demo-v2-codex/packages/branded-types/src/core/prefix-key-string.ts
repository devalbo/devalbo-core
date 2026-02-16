import { z } from 'zod';
import type { Branded, IdTypeKeyMethodBrand, IdTypePrefixBrand, RegexableString } from './brand-types';

export interface IKeyMethodology<
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
> {
  idPrefix: P;
  createIdPrefixRegexStr: (idPrefix: P) => RegexableString;
  keyRegexStr: RegexableString;
  generateRandomKey?: () => KM;
}

export type BrandedPrefixKeyString<
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
> = Branded<string, ['PrefixKeyString', P, KM]>;

export type BrandedPrefixKeyStringSchema<
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
> = z.ZodTypeAny;

export interface IBrandedPrefixKeyStringToolbox<
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
> {
  idSchema: BrandedPrefixKeyStringSchema<P, KM>;
  idPrefix: P;
  separator: string;
  keyMethodology: IKeyMethodology<P, KM>;
  createRandomId?: () => BrandedPrefixKeyString<P, KM>;
  createIdForKey: (key: KM) => BrandedPrefixKeyString<P, KM>;
  parseId: (id: string) => z.ZodSafeParseResult<BrandedPrefixKeyString<P, KM>>;
  assertId: (id: string) => BrandedPrefixKeyString<P, KM>;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeRegexFragment = (fragment: string): string =>
  fragment.replace(/^\^+/, '').replace(/\$+$/, '');

const createPrefixKeyStringRegex = (prefixRegex: string, separator: string, keyRegex: string): RegExp => {
  const normalizedPrefix = normalizeRegexFragment(prefixRegex);
  const normalizedKey = normalizeRegexFragment(keyRegex);
  return new RegExp(`^${normalizedPrefix}${escapeRegExp(separator)}${normalizedKey}$`);
};

export const createBrandedPrefixKeyStringSchema = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(keyMethodology: IKeyMethodology<P, KM>, separator: string): BrandedPrefixKeyStringSchema<P, KM> => {
  const prefixRegex = keyMethodology.createIdPrefixRegexStr(keyMethodology.idPrefix);
  const regex = createPrefixKeyStringRegex(prefixRegex, separator, keyMethodology.keyRegexStr);

  return z
    .string()
    .regex(regex)
    .transform((value) => value as BrandedPrefixKeyString<P, KM>) as unknown as BrandedPrefixKeyStringSchema<P, KM>;
};

export const createBrandedPrefixKeyStringValue = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(
  idPrefix: P,
  separator: string,
  keyValue: KM,
): BrandedPrefixKeyString<P, KM> => `${idPrefix}${separator}${keyValue}` as BrandedPrefixKeyString<P, KM>;

export const parseBrandedPrefixKeyStringValue = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(
  schema: BrandedPrefixKeyStringSchema<P, KM>,
  value: string,
): z.ZodSafeParseResult<BrandedPrefixKeyString<P, KM>> =>
  schema.safeParse(value) as z.ZodSafeParseResult<BrandedPrefixKeyString<P, KM>>;

export const assertBrandedPrefixKeyStringValue = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(
  schema: BrandedPrefixKeyStringSchema<P, KM>,
  value: string,
): BrandedPrefixKeyString<P, KM> => schema.parse(value) as BrandedPrefixKeyString<P, KM>;

export const isValidBrandedPrefixKeyStringValue = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(
  id: string,
  idPrefixRegex: P,
  keyRegex: KM,
  separator = '',
): id is BrandedPrefixKeyString<P, KM> => {
  const regex = createPrefixKeyStringRegex(idPrefixRegex as string, separator, keyRegex as string);
  return regex.test(id);
};

export const createBrandedPrefixKeyStringToolbox = <
  P extends IdTypePrefixBrand,
  KM extends IdTypeKeyMethodBrand,
>(
  keyMethodology: IKeyMethodology<P, KM>,
  separator: string,
): IBrandedPrefixKeyStringToolbox<P, KM> => {
  const idSchema = createBrandedPrefixKeyStringSchema(keyMethodology, separator);

  const parseId = (id: string) => parseBrandedPrefixKeyStringValue(idSchema, id);
  const assertId = (id: string) => assertBrandedPrefixKeyStringValue(idSchema, id);
  const createIdForKey = (key: KM) =>
    createBrandedPrefixKeyStringValue(keyMethodology.idPrefix, separator, key);

  const toolbox: IBrandedPrefixKeyStringToolbox<P, KM> = {
    idSchema,
    idPrefix: keyMethodology.idPrefix,
    separator,
    keyMethodology,
    createIdForKey,
    parseId,
    assertId,
  };

  if (keyMethodology.generateRandomKey) {
    toolbox.createRandomId = () => createIdForKey(keyMethodology.generateRandomKey!());
  }

  return toolbox;
};
