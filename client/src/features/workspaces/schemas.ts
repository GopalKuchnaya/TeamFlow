import { z } from 'zod';

// Mirrors server/src/modules/workspaces/workspace.schemas.ts.
export const workspaceFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters'),
});
export type WorkspaceFormInput = z.infer<typeof workspaceFormSchema>;

export const inviteFormSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  role: z.enum(['admin', 'member']),
});
export type InviteFormInput = z.infer<typeof inviteFormSchema>;
