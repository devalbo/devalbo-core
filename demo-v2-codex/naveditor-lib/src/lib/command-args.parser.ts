import { argument, formatMessage, object, optional, parse, string, type Parser } from '@optique/core';
import { z } from 'zod';
import {
  CatArgsSchema,
  CdArgsSchema,
  type CdArgsInput,
  type CatArgsInput,
  CpArgsSchema,
  type CpArgsInput,
  ExportArgsSchema,
  type ExportArgsInput,
  ImportArgsSchema,
  type ImportArgsInput,
  LsArgsSchema,
  type LsArgsInput,
  MkdirArgsSchema,
  type MkdirArgsInput,
  MvArgsSchema,
  type MvArgsInput,
  RmArgsSchema,
  type RmArgsInput,
  SolidExportArgsSchema,
  type SolidExportArgsInput,
  SolidImportArgsSchema,
  type SolidImportArgsInput,
  StatArgsSchema,
  type StatArgsInput,
  TouchArgsSchema,
  type TouchArgsInput,
  TreeArgsSchema,
  type TreeArgsInput
} from './command-args.schema';

type ParserShapeFor<T extends Record<string, unknown>> = {
  [K in keyof T]-?: Parser<'sync', T[K], unknown>;
};

const cpParser = object({
  source: argument(string()),
  dest: argument(string())
} satisfies ParserShapeFor<CpArgsInput>);

const cdParser = object({
  path: argument(string())
} satisfies ParserShapeFor<CdArgsInput>);

const lsParser = object({
  path: optional(argument(string()))
} satisfies ParserShapeFor<LsArgsInput>);

const treeParser = object({
  path: optional(argument(string()))
} satisfies ParserShapeFor<TreeArgsInput>);

const statParser = object({
  path: argument(string())
} satisfies ParserShapeFor<StatArgsInput>);

const catParser = object({
  file: argument(string())
} satisfies ParserShapeFor<CatArgsInput>);

const touchParser = object({
  file: argument(string())
} satisfies ParserShapeFor<TouchArgsInput>);

const mkdirParser = object({
  path: argument(string())
} satisfies ParserShapeFor<MkdirArgsInput>);

const rmParser = object({
  path: argument(string())
} satisfies ParserShapeFor<RmArgsInput>);

const mvParser = object({
  source: argument(string()),
  dest: argument(string())
} satisfies ParserShapeFor<MvArgsInput>);

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

export type CpArgs = CpArgsInput;
export type CdArgs = CdArgsInput;
export type LsArgs = LsArgsInput;
export type TreeArgs = TreeArgsInput;
export type StatArgs = StatArgsInput;
export type CatArgs = CatArgsInput;
export type TouchArgs = TouchArgsInput;
export type MkdirArgs = MkdirArgsInput;
export type RmArgs = RmArgsInput;
export type MvArgs = MvArgsInput;
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
    return {
      success: false,
      error: formatMessage(result.error)
    };
  }

  const input = mapValue ? mapValue(result.value) : result.value;
  const validated = schema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: zodErrorToMessage(validated.error)
    };
  }

  return {
    success: true,
    value: validated.data
  };
};

export const parseCpArgs = (args: string[]): ParseResult<CpArgs> => parseWithSchema(cpParser, args, CpArgsSchema);

export const parseCdArgs = (args: string[]): ParseResult<CdArgs> => parseWithSchema(cdParser, args, CdArgsSchema);

export const parseLsArgs = (args: string[]): ParseResult<LsArgs> => parseWithSchema(lsParser, args, LsArgsSchema);

export const parseTreeArgs = (args: string[]): ParseResult<TreeArgs> => parseWithSchema(treeParser, args, TreeArgsSchema);

export const parseStatArgs = (args: string[]): ParseResult<StatArgs> => parseWithSchema(statParser, args, StatArgsSchema);

export const parseCatArgs = (args: string[]): ParseResult<CatArgs> => parseWithSchema(catParser, args, CatArgsSchema);

export const parseTouchArgs = (args: string[]): ParseResult<TouchArgs> => parseWithSchema(touchParser, args, TouchArgsSchema);

export const parseMkdirArgs = (args: string[]): ParseResult<MkdirArgs> => parseWithSchema(mkdirParser, args, MkdirArgsSchema);

export const parseRmArgs = (args: string[]): ParseResult<RmArgs> => parseWithSchema(rmParser, args, RmArgsSchema);

export const parseMvArgs = (args: string[]): ParseResult<MvArgs> => parseWithSchema(mvParser, args, MvArgsSchema);

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
