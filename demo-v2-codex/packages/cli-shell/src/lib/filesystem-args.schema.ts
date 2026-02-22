import { z } from 'zod';
import { pathArgSchema } from '@devalbo/shared';

export const PathTokenSchema = pathArgSchema;

export const CdArgsSchema = z.object({
  path: PathTokenSchema
});

export const LsArgsSchema = z.object({
  path: PathTokenSchema.optional()
});

export const TreeArgsSchema = z.object({
  path: PathTokenSchema.optional()
});

export const StatArgsSchema = z.object({
  path: PathTokenSchema
});

export const CatArgsSchema = z.object({
  file: PathTokenSchema
});

export const TouchArgsSchema = z.object({
  file: PathTokenSchema
});

export const MkdirArgsSchema = z.object({
  path: PathTokenSchema
});

export const RmArgsSchema = z.object({
  path: PathTokenSchema
});

export const CpArgsSchema = z.object({
  source: PathTokenSchema,
  dest: PathTokenSchema
});

export const MvArgsSchema = z.object({
  source: PathTokenSchema,
  dest: PathTokenSchema
});

export type CpArgsInput = z.infer<typeof CpArgsSchema>;
export type MvArgsInput = z.infer<typeof MvArgsSchema>;
export type CdArgsInput = z.infer<typeof CdArgsSchema>;
export type LsArgsInput = z.infer<typeof LsArgsSchema>;
export type TreeArgsInput = z.infer<typeof TreeArgsSchema>;
export type StatArgsInput = z.infer<typeof StatArgsSchema>;
export type CatArgsInput = z.infer<typeof CatArgsSchema>;
export type TouchArgsInput = z.infer<typeof TouchArgsSchema>;
export type MkdirArgsInput = z.infer<typeof MkdirArgsSchema>;
export type RmArgsInput = z.infer<typeof RmArgsSchema>;
