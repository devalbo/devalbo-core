import { argument, formatMessage, object, optional, parse, string, type Parser } from '@optique/core';
import { z } from 'zod';
import {
  ExportArgsSchema,
  type ExportArgsInput,
  ImportArgsSchema,
  type ImportArgsInput,
  SolidExportArgsSchema,
  type SolidExportArgsInput,
  SolidImportArgsSchema,
  type SolidImportArgsInput
} from './command-args.schema';

type ParserShapeFor<T extends Record<string, unknown>> = {
  [K in keyof T]-?: Parser<'sync', T[K], unknown>;
};

const importParser = object({
  firstArg: optional(argument(string())),
  secondArg: optional(argument(string()))
} satisfies ParserShapeFor<ImportArgsInput>);

const exportParser = object({
  sourcePath: optional(argument(string())),
  outputPath: optional(argument(string()))
} satisfies ParserShapeFor<ExportArgsInput>);

const solidExportParser = object({
  outputPath: optional(argument(string()))
} satisfies ParserShapeFor<SolidExportArgsInput>);

const solidImportParser = object({
  filePath: argument(string())
} satisfies ParserShapeFor<SolidImportArgsInput>);

export type ImportArgs = ImportArgsInput;
export type ExportArgs = ExportArgsInput;
export type SolidExportArgs = SolidExportArgsInput;
export type SolidImportArgs = SolidImportArgsInput;

type ParseResult<T> = {
  success: true;
  value: T;
} | {
  success: false;
  error: string;
};

const zodErrorToMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join('; ');

const parseWithSchema = <TParsed, TOutput>(
  parser: Parser<'sync', TParsed, unknown>,
  args: string[],
  schema: z.ZodType<TOutput>,
  mapValue?: (value: TParsed) => unknown
): ParseResult<TOutput> => {
  const result = parse(parser, args);
  if (!result.success) {
    return { success: false, error: formatMessage(result.error) };
  }
  const input = mapValue ? mapValue(result.value) : result.value;
  const validated = schema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: zodErrorToMessage(validated.error) };
  }
  return { success: true, value: validated.data };
};

export const parseImportArgs = (args: string[]): ParseResult<ImportArgs> =>
  parseWithSchema(importParser, args, ImportArgsSchema);

export const parseExportArgs = (args: string[]): ParseResult<ExportArgs> =>
  parseWithSchema(exportParser, args, ExportArgsSchema);

export const parseSolidExportArgs = (args: string[]): ParseResult<SolidExportArgs> =>
  parseWithSchema(solidExportParser, args, SolidExportArgsSchema);

export const parseSolidImportArgs = (args: string[]): ParseResult<SolidImportArgs> =>
  parseWithSchema(solidImportParser, args, SolidImportArgsSchema);

export const parseSolidFetchProfileArgs = (
  args: string[]
): { success: true; value: { webId: string } } | { success: false; error: string } => {
  const webId = args[0]?.trim();
  if (!webId) return { success: false, error: 'webId is required' };
  if (!webId.startsWith('http://') && !webId.startsWith('https://')) {
    return { success: false, error: 'webId must be an http(s) URL' };
  }
  return { success: true, value: { webId } };
};

export const parseSolidLoginArgs = (
  args: string[]
): { success: true; value: { issuer: string } } | { success: false; error: string } => {
  const issuer = args[0]?.trim();
  if (!issuer) return { success: false, error: 'issuer is required' };
  if (!issuer.startsWith('http://') && !issuer.startsWith('https://')) {
    return { success: false, error: 'issuer must be an http(s) URL' };
  }
  return { success: true, value: { issuer } };
};

export const parseSolidShareCardArgs = (
  args: string[]
): { success: true; value: { contactId: string } } | { success: false; error: string } => {
  const contactId = args[0]?.trim();
  if (!contactId) return { success: false, error: 'contactId is required' };
  return { success: true, value: { contactId } };
};
