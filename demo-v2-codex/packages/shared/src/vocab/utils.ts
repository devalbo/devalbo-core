import { z } from 'zod';
import { NS } from './namespaces';

export const IRI = z.string().url();
export type IRI = z.infer<typeof IRI>;

export const NodeRef = z.object({
  '@id': IRI
});
export type NodeRef = z.infer<typeof NodeRef>;

export function oneOrMany<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)]);
}

export function generateUID(): string {
  return `urn:uuid:${crypto.randomUUID()}`;
}

export function iri(namespace: keyof typeof NS, localName: string): string {
  return `${NS[namespace]}${localName}`;
}

export function isNodeRef(value: unknown): value is NodeRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '@id' in value &&
    typeof (value as NodeRef)['@id'] === 'string'
  );
}

export function getId(value: NodeRef | string): string {
  return isNodeRef(value) ? value['@id'] : value;
}

export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function nowISO(): string {
  return new Date().toISOString();
}
