import { z } from 'zod';

export const EditorBufferRowSchema = z.object({
  path: z.string(),
  content: z.string(),
  isDirty: z.boolean(),
  cursorLine: z.number(),
  cursorCol: z.number()
});
