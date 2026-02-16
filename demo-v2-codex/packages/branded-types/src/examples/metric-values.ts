import { z } from 'zod';
import {
  IdTypeKeyMethodBrandSchema,
  type IdTypePrefixBrand,
  type RegexableString,
} from '../core/brand-types';
import {
  createBrandedPrefixKeyStringToolbox,
  type BrandedPrefixKeyString,
  type IBrandedPrefixKeyStringToolbox,
  type IKeyMethodology,
} from '../core/prefix-key-string';

export const NumericValueMethodBrandKey = 'numeric-value-methodology' as const;
export const NumericValueKeyValueSchema = IdTypeKeyMethodBrandSchema.brand(NumericValueMethodBrandKey);
export type NumericValueKeyValue = z.infer<typeof NumericValueKeyValueSchema>;

const NumericValueRegex = '-?[0-9]+(\\.[0-9]+)?' as RegexableString;
const NonNegativeNumericValueRegex = '[0-9]+(\\.[0-9]+)?' as RegexableString;

export const createNumericValueMethodology = <P extends IdTypePrefixBrand>(
  prefix: P,
  options?: { allowNegative?: boolean },
): IKeyMethodology<P, NumericValueKeyValue> => ({
  idPrefix: prefix,
  createIdPrefixRegexStr: (idPrefix: P) => idPrefix as unknown as RegexableString,
  keyRegexStr: options?.allowNegative === false ? NonNegativeNumericValueRegex : NumericValueRegex,
});

const createMetricToolbox = <P extends IdTypePrefixBrand>(
  prefix: P,
  options?: { allowNegative?: boolean },
): IBrandedPrefixKeyStringToolbox<P, NumericValueKeyValue> =>
  createBrandedPrefixKeyStringToolbox(createNumericValueMethodology(prefix, options), '_');

export const KgToolbox = createMetricToolbox('kg' as IdTypePrefixBrand, { allowNegative: false });
export const LbToolbox = createMetricToolbox('lb' as IdTypePrefixBrand, { allowNegative: false });
export const MToolbox = createMetricToolbox('m' as IdTypePrefixBrand, { allowNegative: false });
export const FtToolbox = createMetricToolbox('ft' as IdTypePrefixBrand, { allowNegative: false });
export const DegCToolbox = createMetricToolbox('degC' as IdTypePrefixBrand, { allowNegative: true });
export const DegFToolbox = createMetricToolbox('degF' as IdTypePrefixBrand, { allowNegative: true });
export const KToolbox = createMetricToolbox('K' as IdTypePrefixBrand, { allowNegative: false });

export type KilogramsValue = ReturnType<typeof KgToolbox.createIdForKey>;
export type PoundsValue = ReturnType<typeof LbToolbox.createIdForKey>;
export type MetersValue = ReturnType<typeof MToolbox.createIdForKey>;
export type FeetValue = ReturnType<typeof FtToolbox.createIdForKey>;
export type CelsiusValue = ReturnType<typeof DegCToolbox.createIdForKey>;
export type FahrenheitValue = ReturnType<typeof DegFToolbox.createIdForKey>;
export type KelvinValue = ReturnType<typeof KToolbox.createIdForKey>;

export const extractNumber = (value: BrandedPrefixKeyString<IdTypePrefixBrand, NumericValueKeyValue>): number => {
  const [, raw] = value.split('_');
  return Number.parseFloat(raw ?? 'NaN');
};

const toNumericValueKey = (value: number): NumericValueKeyValue => `${value}` as NumericValueKeyValue;

export const createKg = (value: number): KilogramsValue => KgToolbox.createIdForKey(toNumericValueKey(value));
export const createLb = (value: number): PoundsValue => LbToolbox.createIdForKey(toNumericValueKey(value));
export const createM = (value: number): MetersValue => MToolbox.createIdForKey(toNumericValueKey(value));
export const createFt = (value: number): FeetValue => FtToolbox.createIdForKey(toNumericValueKey(value));
export const createDegC = (value: number): CelsiusValue => DegCToolbox.createIdForKey(toNumericValueKey(value));
export const createDegF = (value: number): FahrenheitValue => DegFToolbox.createIdForKey(toNumericValueKey(value));
export const createK = (value: number): KelvinValue => KToolbox.createIdForKey(toNumericValueKey(value));

export const kilogramsToPounds = (value: KilogramsValue): PoundsValue => createLb(+(extractNumber(value) * 2.20462).toFixed(6));
export const poundsToKilograms = (value: PoundsValue): KilogramsValue => createKg(+(extractNumber(value) / 2.20462).toFixed(6));

export const metersToFeet = (value: MetersValue): FeetValue => createFt(+(extractNumber(value) / 0.3048).toFixed(6));
export const feetToMeters = (value: FeetValue): MetersValue => createM(+(extractNumber(value) * 0.3048).toFixed(6));

export const celsiusToFahrenheit = (value: CelsiusValue): FahrenheitValue =>
  createDegF(+(extractNumber(value) * 9 / 5 + 32).toFixed(6));

export const fahrenheitToCelsius = (value: FahrenheitValue): CelsiusValue =>
  createDegC(+((extractNumber(value) - 32) * 5 / 9).toFixed(6));

export const celsiusToKelvin = (value: CelsiusValue): KelvinValue => createK(+(extractNumber(value) + 273.15).toFixed(6));
export const kelvinToCelsius = (value: KelvinValue): CelsiusValue => createDegC(+(extractNumber(value) - 273.15).toFixed(6));

export const fahrenheitToKelvin = (value: FahrenheitValue): KelvinValue => celsiusToKelvin(fahrenheitToCelsius(value));
