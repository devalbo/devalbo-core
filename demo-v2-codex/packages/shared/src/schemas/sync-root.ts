import { z } from 'zod';
import { DirectoryPathSchema, PodUrlSchema, SyncRootIdSchema, WebIdSchema } from '../types/branded';

export const SyncRootSchema = z.object({
  id: SyncRootIdSchema,
  label: z.string(),
  localPath: DirectoryPathSchema.refine((path) => path.endsWith('/'), 'sync root localPath must end with "/"'),
  podUrl: PodUrlSchema,
  webId: WebIdSchema,
  readonly: z.boolean(),
  enabled: z.boolean()
});

export type SyncRoot = z.infer<typeof SyncRootSchema>;
