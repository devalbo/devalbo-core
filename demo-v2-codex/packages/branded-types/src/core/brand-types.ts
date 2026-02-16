import { z } from 'zod';

declare const __brand: unique symbol;

type Brand<B> = { [__brand]: B };

export type Branded<T, B> = T & Brand<B>;

export const IdTypePrefixBrandKey = 'id-type-prefix' as const;
export const IdTypeKeyMethodBrandKey = 'id-type-key-method' as const;

export const IdTypePrefixBrandSchema = z.string().brand(IdTypePrefixBrandKey);
export type IdTypePrefixBrand = z.infer<typeof IdTypePrefixBrandSchema>;

export const IdTypeKeyMethodBrandSchema = z.string().brand(IdTypeKeyMethodBrandKey);
export type IdTypeKeyMethodBrand = z.infer<typeof IdTypeKeyMethodBrandSchema>;

export const RegexableStringSchema = z.string().brand('regexable-string');
export type RegexableString = z.infer<typeof RegexableStringSchema>;
