import { z } from 'zod';
import { objectIdSchema } from '../../utils/object-id.js';

const name = z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters');
const description = z.string().trim().max(500, 'Description must be at most 500 characters');

export const workspaceParamsSchema = z.object({ workspaceId: objectIdSchema });

export const createWorkspaceSchema = z.object({
  name,
  description: description.optional().default(''),
});

export const updateWorkspaceSchema = z
  .object({ name: name.optional(), description: description.optional() })
  .refine((input) => input.name !== undefined || input.description !== undefined, {
    message: 'Provide at least one field to update',
  });

export const transferOwnershipSchema = z.object({ userId: objectIdSchema });

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
