import { z } from 'zod';
import type { Branded } from '../core/brand-types';

export type BrandedNumber<B extends string> = Branded<number, ['BrandedNumber', B]>;

export const createBrandedIntSchema = <B extends string>(brand: B) =>
  z.number().int().transform((value) => value as BrandedNumber<B>);

export const createBrandedNonNegativeIntSchema = <B extends string>(brand: B) =>
  z.number().int().nonnegative().transform((value) => value as BrandedNumber<B>);

export const createBrandedFiniteNumberSchema = <B extends string>(brand: B) =>
  z.number().finite().transform((value) => value as BrandedNumber<B>);

export const createBrandedPositiveIntSchema = <B extends string>(brand: B) =>
  z.number().int().positive().transform((value) => value as BrandedNumber<B>);

export const unsafeAsBrandedNumber = <B extends string>(value: number): BrandedNumber<B> =>
  value as BrandedNumber<B>;
