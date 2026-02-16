import type { z } from 'zod';

export const safeParseWithWarning = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  table: string,
  rowId: string,
  context: 'get' | 'list'
): T | null => {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues;
  const issuesText = issues
    .map((issue) => `${(issue.path ?? []).map((value) => String(value)).join('.') || '<root>'}: ${issue.message ?? 'invalid value'}`)
    .join('; ');

  console.warn(
    `[devalbo-state] Dropping invalid ${table} row during ${context} for id=${rowId}. ` +
    `Issues: ${issuesText}`
  );

  return null;
};
