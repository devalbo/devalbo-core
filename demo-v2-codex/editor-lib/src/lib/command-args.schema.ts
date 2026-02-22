import { z } from 'zod';
import { pathArgSchema } from '@devalbo/shared';

export const PathTokenSchema = pathArgSchema;

export const ImportArgsSchema = z.object({
  firstArg: PathTokenSchema.optional(),
  secondArg: PathTokenSchema.optional()
});

export const ExportArgsSchema = z.object({
  sourcePath: PathTokenSchema.optional(),
  outputPath: PathTokenSchema.optional()
});

export const SolidExportArgsSchema = z.object({
  outputPath: PathTokenSchema.optional()
});

export const SolidImportArgsSchema = z.object({
  filePath: PathTokenSchema
});

export type ImportArgsInput = z.infer<typeof ImportArgsSchema>;
export type ExportArgsInput = z.infer<typeof ExportArgsSchema>;
export type SolidExportArgsInput = z.infer<typeof SolidExportArgsSchema>;
export type SolidImportArgsInput = z.infer<typeof SolidImportArgsSchema>;
