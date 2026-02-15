import type { MimeTypeHandler, ResolvedMimeTypeHandler } from './types';

const exactHandlers = new Map<string, MimeTypeHandler>();
const wildcardHandlers = new Map<string, MimeTypeHandler>();
let defaultsRegistered = false;

const normalizePattern = (pattern: string): string => pattern.trim().toLowerCase();

const isWildcardPattern = (pattern: string): boolean => pattern.endsWith('/*');

const wildcardPrefix = (pattern: string): string => pattern.slice(0, pattern.length - 2);

export const registerMimeTypeHandler = (pattern: string, handler: MimeTypeHandler): void => {
  const normalized = normalizePattern(pattern);
  if (!normalized.includes('/')) {
    throw new Error(`Invalid MIME type pattern: ${pattern}`);
  }
  if (isWildcardPattern(normalized)) {
    wildcardHandlers.set(wildcardPrefix(normalized), handler);
    return;
  }
  exactHandlers.set(normalized, handler);
};

export const resolveMimeTypeHandler = (mimeType: string): ResolvedMimeTypeHandler | null => {
  const normalized = normalizePattern(mimeType);
  const exact = exactHandlers.get(normalized);
  if (exact) return { pattern: normalized, ...exact };

  const slash = normalized.indexOf('/');
  if (slash > 0) {
    const major = normalized.slice(0, slash);
    const wildcard = wildcardHandlers.get(major);
    if (wildcard) return { pattern: `${major}/*`, ...wildcard };
  }

  return null;
};

export const clearMimeTypeHandlers = (): void => {
  exactHandlers.clear();
  wildcardHandlers.clear();
  defaultsRegistered = false;
};

export const listMimeTypeHandlers = (): Array<ResolvedMimeTypeHandler> => {
  const out: Array<ResolvedMimeTypeHandler> = [];
  for (const [pattern, handler] of exactHandlers.entries()) {
    out.push({ pattern, ...handler });
  }
  for (const [prefix, handler] of wildcardHandlers.entries()) {
    out.push({ pattern: `${prefix}/*`, ...handler });
  }
  return out.sort((left, right) => left.pattern.localeCompare(right.pattern));
};

export const markDefaultMimeHandlersRegistered = (): void => {
  defaultsRegistered = true;
};

export const areDefaultMimeHandlersRegistered = (): boolean => defaultsRegistered;
