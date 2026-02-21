import { contactToJsonLd, jsonLdToContactRow, jsonLdToGroupRow, jsonLdToPersonaRow, personaToJsonLd } from '@devalbo/state';
import type {
  ContactId,
  ContactRow,
  ContactRowInput,
  GroupId,
  GroupRowInput,
  PersonaId,
  PersonaRow,
  PersonaRowInput
} from '@devalbo/shared';

type FetchFn = typeof globalThis.fetch;
type JsonLdObject = Record<string, unknown>;

const LDP_CONTAINER_LINK = '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"';
const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';

export class SolidLdpPersister {
  private readonly appRoot: string;

  constructor(
    podRoot: string,
    private readonly podNamespace: string,
    private readonly fetchFn: FetchFn
  ) {
    const base = podRoot.endsWith('/') ? podRoot : `${podRoot}/`;
    this.appRoot = `${base}${podNamespace}/`;
  }

  private resourceUrl(container: string, id: string): string {
    return `${this.appRoot}${container}/${encodeURIComponent(id)}.jsonld`;
  }

  async ensureContainer(name: string): Promise<void> {
    const containerUrl = `${this.appRoot}${name}/`;
    const probe = await this.fetchFn(containerUrl, { method: 'HEAD' });
    if (probe.status !== 404) return;

    const appProbe = await this.fetchFn(this.appRoot, { method: 'HEAD' });
    if (appProbe.status === 404) {
      const parentUrl = this.appRoot.slice(0, -(this.podNamespace.length + 1));
      const createApp = await this.fetchFn(parentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: this.podNamespace,
          Link: LDP_CONTAINER_LINK
        },
        body: ''
      });
      if (!createApp.ok && createApp.status !== 409) {
        throw new Error(`Create app root container failed: HTTP ${createApp.status}`);
      }
    }

    const createContainer = await this.fetchFn(this.appRoot, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/turtle',
        Slug: name,
        Link: LDP_CONTAINER_LINK
      },
      body: ''
    });
    if (!createContainer.ok && createContainer.status !== 409) {
      throw new Error(`Create container "${name}" failed: HTTP ${createContainer.status}`);
    }
  }

  private async listContainerMembers(containerUrl: string): Promise<string[]> {
    const members: string[] = [];
    let url: string | null = containerUrl;

    while (url) {
      const response: Response = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
      if (!response.ok) throw new Error(`GET ${url} → HTTP ${response.status}`);
      const body = await response.json() as JsonLdObject;

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

  async putPersona(row: PersonaRow, id: PersonaId): Promise<void> {
    const url = `${this.appRoot}persona.jsonld`;
    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(personaToJsonLd(row, id), null, 2)
    });
    if (!response.ok) throw new Error(`PUT persona → HTTP ${response.status}`);
  }

  async getPersona(): Promise<{ id: PersonaId; row: PersonaRowInput } | null> {
    const url = `${this.appRoot}persona.jsonld`;
    const response = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET persona → HTTP ${response.status}`);
    return jsonLdToPersonaRow(await response.json() as JsonLdObject);
  }

  async putContact(row: ContactRow, id: ContactId): Promise<void> {
    await this.ensureContainer('contacts');
    const response = await this.fetchFn(this.resourceUrl('contacts', id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(contactToJsonLd(row, id), null, 2)
    });
    if (!response.ok) throw new Error(`PUT contact ${id} → HTTP ${response.status}`);
  }

  async deleteContact(id: ContactId): Promise<void> {
    const response = await this.fetchFn(this.resourceUrl('contacts', id), { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE contact ${id} → HTTP ${response.status}`);
    }
  }

  async listContacts(): Promise<Array<{ id: ContactId; row: ContactRowInput }>> {
    const containerUrl = `${this.appRoot}contacts/`;
    const probe = await this.fetchFn(containerUrl, { method: 'HEAD' });
    if (probe.status === 404) return [];

    const memberUrls = await this.listContainerMembers(containerUrl);
    const results: Array<{ id: ContactId; row: ContactRowInput }> = [];
    for (const url of memberUrls) {
      const response = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
      if (!response.ok) continue;
      try {
        const parsed = jsonLdToContactRow(await response.json() as JsonLdObject);
        if (parsed.row.name) {
          results.push(parsed as { id: ContactId; row: ContactRowInput });
        }
      } catch {
        continue;
      }
    }
    return results;
  }

  async putGroupJsonLd(id: GroupId, jsonLd: JsonLdObject): Promise<void> {
    await this.ensureContainer('groups');
    const response = await this.fetchFn(this.resourceUrl('groups', id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: JSON.stringify(jsonLd, null, 2)
    });
    if (!response.ok) throw new Error(`PUT group ${id} → HTTP ${response.status}`);
  }

  async deleteGroup(id: GroupId): Promise<void> {
    const response = await this.fetchFn(this.resourceUrl('groups', id), { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE group ${id} → HTTP ${response.status}`);
    }
  }

  async listGroups(): Promise<Array<{ id: GroupId; row: GroupRowInput }>> {
    const containerUrl = `${this.appRoot}groups/`;
    const probe = await this.fetchFn(containerUrl, { method: 'HEAD' });
    if (probe.status === 404) return [];

    const memberUrls = await this.listContainerMembers(containerUrl);
    const results: Array<{ id: GroupId; row: GroupRowInput }> = [];
    for (const url of memberUrls) {
      const response = await this.fetchFn(url, { headers: { Accept: 'application/ld+json' } });
      if (!response.ok) continue;
      try {
        const parsed = jsonLdToGroupRow(await response.json() as JsonLdObject);
        if (parsed.row.name) {
          results.push(parsed as { id: GroupId; row: GroupRowInput });
        }
      } catch {
        continue;
      }
    }
    return results;
  }
}
