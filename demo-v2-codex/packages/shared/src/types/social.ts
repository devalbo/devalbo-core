import { z } from 'zod';
import {
  ContactKindSchema,
  ContactRowSchema,
  GroupRowSchema,
  GroupTypeSchema,
  MembershipRowSchema,
  PersonaRowSchema
} from '../schemas/social';

export type GroupType = z.infer<typeof GroupTypeSchema>;
export type ContactKind = z.infer<typeof ContactKindSchema>;

export type PersonaRow = z.output<typeof PersonaRowSchema>;
export type ContactRow = z.output<typeof ContactRowSchema>;
export type GroupRow = z.output<typeof GroupRowSchema>;
export type MembershipRow = z.output<typeof MembershipRowSchema>;

export type PersonaRowInput = z.input<typeof PersonaRowSchema>;
export type ContactRowInput = z.input<typeof ContactRowSchema>;
export type GroupRowInput = z.input<typeof GroupRowSchema>;
export type MembershipRowInput = z.input<typeof MembershipRowSchema>;
