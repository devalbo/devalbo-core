import { z } from 'zod';
import type { Branded } from '@devalbo/branded-types';

export type { Branded };

export type FilePath = Branded<string, 'FilePath'>;
export type DirectoryPath = Branded<string, 'DirectoryPath'>;

export const FilePathSchema = z.string().trim().min(1, 'path is required').transform((path) => path as FilePath);
export const DirectoryPathSchema = z
  .string()
  .trim()
  .min(1, 'path is required')
  .transform((path) => path as DirectoryPath);

export const parseFilePath = (path: string): z.ZodSafeParseResult<FilePath> => FilePathSchema.safeParse(path);
export const parseDirectoryPath = (path: string): z.ZodSafeParseResult<DirectoryPath> =>
  DirectoryPathSchema.safeParse(path);

export const assertFilePath = (path: string): FilePath => FilePathSchema.parse(path);
export const assertDirectoryPath = (path: string): DirectoryPath => DirectoryPathSchema.parse(path);

export const unsafeAsFilePath = (path: string): FilePath => path as FilePath;
export const unsafeAsDirectoryPath = (path: string): DirectoryPath => path as DirectoryPath;

/** @deprecated Use `unsafeAsFilePath` for trusted data or `parseFilePath`/`assertFilePath` for untrusted data. */
export const asFilePath = unsafeAsFilePath;
/** @deprecated Use `unsafeAsDirectoryPath` for trusted data or `parseDirectoryPath`/`assertDirectoryPath` for untrusted data. */
export const asDirectoryPath = unsafeAsDirectoryPath;
