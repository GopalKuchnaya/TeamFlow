import { z } from 'zod';
import { objectIdSchema } from '../../utils/object-id.js';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { WORKSPACE_ROLES } from './membership.model.js';

export const memberParamsSchema = z.object({
  workspaceId: objectIdSchema,
  userId: objectIdSchema,
});

export const listMembersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(WORKSPACE_ROLES).optional(),
});

export const updateMemberRoleSchema = z.object({
  // Ownership moves only through the dedicated transfer endpoint.
  role: z.enum(['admin', 'member']),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
