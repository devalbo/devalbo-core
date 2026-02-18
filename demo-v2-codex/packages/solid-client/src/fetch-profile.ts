import { jsonLdToPersonaRow } from '@devalbo/state';
import type { PersonaId, PersonaRowInput } from '@devalbo/shared';

type JsonLdObject = Record<string, unknown>;

export type ProfileFetchResult =
  | { ok: true; id: PersonaId; row: PersonaRowInput }
  | { ok: false; error: string };

const extractSubjectNode = (parsed: unknown, webId: string): JsonLdObject | null => {
  const matchesId = (value: unknown): value is JsonLdObject =>
    typeof value === 'object' &&
    value !== null &&
    '@id' in value &&
    (value as JsonLdObject)['@id'] === webId;

  if (Array.isArray(parsed)) {
    return (parsed.find(matchesId) as JsonLdObject | undefined) ?? null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const object = parsed as JsonLdObject;

  if (Array.isArray(object['@graph'])) {
    const graphNode = (object['@graph'] as unknown[]).find(matchesId);
    if (graphNode) {
      const merged = { ...(graphNode as JsonLdObject) };
      if (!('@context' in merged) && '@context' in object) merged['@context'] = object['@context'];
      return merged;
    }
  }

  return matchesId(object) ? object : null;
};

export const fetchWebIdProfile = async (webId: string): Promise<ProfileFetchResult> => {
  let response: Response;
  try {
    response = await fetch(webId, {
      headers: { Accept: 'application/ld+json, application/json;q=0.9' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = typeof window !== 'undefined'
      ? ' If you are in a browser, the server may not allow cross-origin requests — try the desktop or terminal client.'
      : '';
    return { ok: false, error: `Network error: ${message}.${hint}` };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    return {
      ok: false,
      error: `Server returned "${contentType}", not JSON-LD. Try the desktop or terminal client (Turtle is supported there), or verify the WebID URL.`
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { ok: false, error: 'Could not parse response as JSON' };
  }

  const node = extractSubjectNode(parsed, webId);
  if (!node) {
    return {
      ok: false,
      error: `Profile document does not contain a node for "${webId}". The server may use Turtle only or the WebID fragment may not match.`
    };
  }

  try {
    const { id, row } = jsonLdToPersonaRow(node);
    if (!row.name.trim()) return { ok: false, error: 'Profile missing required foaf:name' };
    return { ok: true, id: id || (webId as PersonaId), row };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Parse error: ${message}` };
  }
};
