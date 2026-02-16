import { z } from 'zod';

export const FileTreeRowSchema = z.object({
  path: z.string(),
  name: z.string(),
  parentPath: z.string(),
  isDirectory: z.boolean(),
  size: z.number(),
  mtime: z.string()
});
