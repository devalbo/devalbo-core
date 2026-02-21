import type { ByteCount, PodETag, PodUrl, RelativePath } from '@devalbo/shared';
import { unsafeAsByteCount, unsafeAsPodETag, unsafeAsRelativePath } from '@devalbo/shared';

type FetchFn = typeof globalThis.fetch;
type JsonLdObject = Record<string, unknown>;

const LDP_CONTAINER_LINK = '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"';
const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';

const toAbsoluteUrl = (base: string, relativePath: string): string => {
  const encoded = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const suffix = relativePath.endsWith('/') && encoded !== '' ? `${encoded}/` : encoded;
  return `${base}${suffix}`;
};

const parentSegments = (relativePath: string): string[] => {
  const trimmed = relativePath.endsWith('/') ? relativePath.slice(0, -1) : relativePath;
  const parts = trimmed.split('/').filter(Boolean);
  parts.pop();
  const out: string[] = [];
  let current = '';
  for (const part of parts) {
    current = `${current}${part}/`;
    out.push(current);
  }
  return out;
};

export class SolidLdpFilePersister {
  private readonly podContainerUrl: string;

  constructor(podContainerUrl: PodUrl, private readonly fetchFn: FetchFn) {
    this.podContainerUrl = podContainerUrl;
  }

  private etagFromHeaders(headers: Headers): PodETag | null {
    const etag = headers.get('ETag') ?? headers.get('etag') ?? '';
    return etag ? unsafeAsPodETag(etag) : null;
  }

  async ensurePath(relativePath: RelativePath): Promise<void> {
    const chain = parentSegments(relativePath);
    for (const current of chain) {
      const url = toAbsoluteUrl(this.podContainerUrl, current);
      const probe = await this.fetchFn(url, { method: 'HEAD' });
      if (probe.ok) continue;
      if (probe.status !== 404) throw new Error(`HEAD ${url} failed with HTTP ${probe.status}`);

      const parent = toAbsoluteUrl(this.podContainerUrl, parentSegments(current).at(-1) ?? '');
      const slug = current.split('/').filter(Boolean).at(-1) ?? '';
      const create = await this.fetchFn(parent, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: slug,
          Link: LDP_CONTAINER_LINK
        },
        body: ''
      });
      if (!create.ok && create.status !== 409) {
        throw new Error(`Create container "${slug}" failed: HTTP ${create.status}`);
      }
    }
  }

  async putFile(relativePath: RelativePath, content: Uint8Array, mimeType?: string): Promise<{ etag: PodETag | null }> {
    await this.ensurePath(relativePath);
    const url = toAbsoluteUrl(this.podContainerUrl, relativePath);
    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType ?? 'application/octet-stream' },
      body: content as unknown as BodyInit
    });
    if (!response.ok) throw new Error(`PUT ${url} failed: HTTP ${response.status}`);
    return { etag: this.etagFromHeaders(response.headers) };
  }

  async getFile(relativePath: RelativePath): Promise<{ content: Uint8Array; etag: PodETag | null } | null> {
    const url = toAbsoluteUrl(this.podContainerUrl, relativePath);
    const response = await this.fetchFn(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
    return {
      content: new Uint8Array(await response.arrayBuffer()),
      etag: this.etagFromHeaders(response.headers)
    };
  }

  async statFile(relativePath: RelativePath): Promise<{ etag: PodETag | null; size: ByteCount } | null> {
    const url = toAbsoluteUrl(this.podContainerUrl, relativePath);
    const response = await this.fetchFn(url, { method: 'HEAD' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HEAD ${url} failed: HTTP ${response.status}`);
    const length = Number(response.headers.get('Content-Length') ?? '0');
    return {
      etag: this.etagFromHeaders(response.headers),
      size: unsafeAsByteCount(Number.isFinite(length) && length >= 0 ? length : 0)
    };
  }

  async deleteFile(relativePath: RelativePath): Promise<void> {
    const url = toAbsoluteUrl(this.podContainerUrl, relativePath);
    const response = await this.fetchFn(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE ${url} failed: HTTP ${response.status}`);
    }
  }

  private async listContainerMembers(containerUrl: string): Promise<string[]> {
    const members: string[] = [];
    let url: string | null = containerUrl;
    while (url) {
      const response: Response = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
      const body = (await response.json()) as JsonLdObject;
      const contains = body['ldp:contains'] ?? body[LDP_CONTAINS];
      for (const member of [contains].flat().filter(Boolean)) {
        const id = typeof member === 'string' ? member : (member as JsonLdObject)['@id'];
        if (typeof id === 'string') members.push(id);
      }
      const link: string = response.headers.get('link') ?? '';
      url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return members;
  }

  async listFiles(dirRelativePath?: RelativePath): Promise<Array<{ path: RelativePath; etag: PodETag | null; size: ByteCount }>> {
    const rootUrl = toAbsoluteUrl(this.podContainerUrl, dirRelativePath ?? unsafeAsRelativePath(''));
    const memberUrls = await this.listContainerMembers(rootUrl);
    const results: Array<{ path: RelativePath; etag: PodETag | null; size: ByteCount }> = [];

    for (const memberUrl of memberUrls) {
      if (memberUrl.endsWith('/')) {
        const nestedRelative = memberUrl.slice(this.podContainerUrl.length);
        const nested = await this.listFiles(unsafeAsRelativePath(nestedRelative));
        results.push(...nested);
        continue;
      }
      const relative = unsafeAsRelativePath(memberUrl.slice(this.podContainerUrl.length));
      const stat = await this.statFile(relative);
      results.push({
        path: relative,
        etag: stat?.etag ?? null,
        size: stat?.size ?? unsafeAsByteCount(0)
      });
    }

    return results;
  }

  async deleteAll(): Promise<void> {
    const files = await this.listFiles();
    for (const file of files) {
      await this.deleteFile(file.path);
    }
  }
}
