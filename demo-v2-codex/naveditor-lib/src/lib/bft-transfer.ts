import { z } from 'zod';

const BftTextNodeSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
  comment: z.string().optional()
});

const BftBinaryNodeSchema = z.object({
  type: z.literal('binary'),
  encoding: z.literal('base64'),
  content: z.string(),
  comment: z.string().optional()
});

export type BftTextNode = z.infer<typeof BftTextNodeSchema>;
export type BftBinaryNode = z.infer<typeof BftBinaryNodeSchema>;

export interface BftDirectoryNode {
  type: 'directory';
  entries: Record<string, BftNode>;
  comment?: string | undefined;
}

export type BftNode = BftTextNode | BftBinaryNode | BftDirectoryNode;

const BftNodeSchema: z.ZodType<BftNode> = z.lazy(() =>
  z.union([
    BftTextNodeSchema,
    BftBinaryNodeSchema,
    z.object({
      type: z.literal('directory'),
      entries: z.record(z.string(), BftNodeSchema),
      comment: z.string().optional()
    })
  ])
);

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export const isUtf8Text = (bytes: Uint8Array): boolean => {
  try {
    const decoded = utf8Decoder.decode(bytes);
    return !decoded.includes('\u0000');
  } catch {
    return false;
  }
};

export const bytesToBftNode = (bytes: Uint8Array): BftTextNode | BftBinaryNode => {
  if (isUtf8Text(bytes)) {
    return {
      type: 'text',
      content: new TextDecoder().decode(bytes)
    };
  }

  return {
    type: 'binary',
    encoding: 'base64',
    content: (() => {
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      if (typeof btoa === 'function') return btoa(binary);
      const nodeBuffer = (globalThis as { Buffer?: { from: (value: string, enc?: BufferEncoding) => { toString: (enc: BufferEncoding) => string } } }).Buffer;
      if (!nodeBuffer) throw new Error('No base64 encoder available in this runtime');
      return nodeBuffer.from(binary, 'binary').toString('base64');
    })()
  };
};

export const bftNodeToBytes = (node: BftTextNode | BftBinaryNode): Uint8Array => {
  if (node.type === 'text') {
    return new TextEncoder().encode(node.content);
  }
  if (typeof atob === 'function') {
    const binary = atob(node.content);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  const nodeBuffer = (globalThis as { Buffer?: { from: (value: string, enc?: BufferEncoding) => Uint8Array } }).Buffer;
  if (!nodeBuffer) throw new Error('No base64 decoder available in this runtime');
  return new Uint8Array(nodeBuffer.from(node.content, 'base64'));
};

export const parseBftJson = (text: string): BftDirectoryNode => {
  const parsed = JSON.parse(text) as unknown;
  const node = BftNodeSchema.parse(parsed);
  if (node.type !== 'directory') {
    throw new Error('BFT root node must be a directory');
  }
  return node;
};

export const stringifyBft = (node: BftDirectoryNode): string => JSON.stringify(node, null, 2);

export const sortedEntries = (entries: Record<string, BftNode>): Array<[string, BftNode]> =>
  Object.entries(entries).sort(([left], [right]) => left.localeCompare(right));
