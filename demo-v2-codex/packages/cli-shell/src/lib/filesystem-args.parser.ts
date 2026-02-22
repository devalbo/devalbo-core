import { argument, formatMessage, object, optional, parse, string, type Parser } from '@optique/core';
import { z } from 'zod';
import {
  CatArgsSchema,
  type CatArgsInput,
  CdArgsSchema,
  type CdArgsInput,
  CpArgsSchema,
  type CpArgsInput,
  LsArgsSchema,
  type LsArgsInput,
  MkdirArgsSchema,
  type MkdirArgsInput,
  MvArgsSchema,
  type MvArgsInput,
  RmArgsSchema,
  type RmArgsInput,
  StatArgsSchema,
  type StatArgsInput,
  TouchArgsSchema,
  type TouchArgsInput,
  TreeArgsSchema,
  type TreeArgsInput
} from './filesystem-args.schema';

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

type ParseResult<T> =
  | {
    success: true;
    value: T;
  }
  | {
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
