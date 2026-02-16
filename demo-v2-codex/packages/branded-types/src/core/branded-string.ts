import { z } from 'zod';
import type { Branded } from './brand-types';

export type BrandedString<B extends string> = Branded<string, ['BrandedString', B]>;

export type BrandedStringSchema<B extends string> = z.ZodTypeAny;

export interface IBrandedStringToolbox<B extends string> {
  schema: BrandedStringSchema<B>;
  createBrandedString: (value: string) => BrandedString<B>;
}

export interface IBrandedStringToolboxForSchema<T extends z.ZodTypeAny, B extends string> {
  schema: T;
  brandSchema: BrandedStringSchema<B>;
  hydrateFromString: (value: string) => z.infer<T>;
  createBrandedString: (value: string) => BrandedString<B>;
}

export const createBrandedStringSchema = <B extends string>(name: B): BrandedStringSchema<B> =>
  z.string().transform((value) => value as BrandedString<B>) as unknown as BrandedStringSchema<B>;

export const createBrandedStringToolbox = <B extends string>(name: B): IBrandedStringToolbox<B> => {
  const schema = createBrandedStringSchema(name).describe(`Branded string: ${name}`);
  return {
    schema,
    createBrandedString: (value: string) => schema.parse(value) as BrandedString<B>,
  };
};

export const createBrandedStringToolboxForSchema = <T extends z.ZodTypeAny>(
  schema: T,
): IBrandedStringToolboxForSchema<T, string> => {
  if (!schema.description) {
    throw new Error('Schema for branded string has no description');
  }

  const brandName = schema.description;
  const brandSchema = createBrandedStringSchema(brandName);

  return {
    schema,
    brandSchema,
    hydrateFromString: (value: string) => schema.parse(JSON.parse(value)) as z.infer<T>,
    createBrandedString: (value: string) => brandSchema.parse(value) as BrandedString<string>,
  };
};
