import { z } from 'zod';

export const nonEmptyString = (argName: string) =>
  z.string().trim().min(1, `${argName} is required`);

export const pathArgSchema = z.string().trim().min(1, 'path is required');
