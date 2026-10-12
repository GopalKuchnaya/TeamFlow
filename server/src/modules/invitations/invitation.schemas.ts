import { z } from 'zod';
import { objectIdSchema } from '../../utils/object-id.js';
import { INVITABLE_ROLES } from './invitation.model.js';

export const invitationParamsSchema = z.object({
  workspaceId: objectIdSchema,
  invitationId: objectIdSchema,
});

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  role: z.enum(INVITABLE_ROLES).default('member'),
});

/** Tokens travel in request bodies, never URLs, so they stay out of access logs. */
export const invitationTokenSchema = z.object({
  token: z.string().min(20).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid invitation token'),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
