import { z } from 'zod';

/** Runtime-validated API DTOs. Parsing responses keeps network data honest at the boundary. */
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const sessionResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  expiresIn: z.number(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const meResponseSchema = z.object({ user: userSchema });

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    requestId: z.string().optional(),
  }),
});
export type FieldIssue = { path: string; message: string };

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
}

export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export const invitableRoleSchema = z.enum(['admin', 'member']);
export type InvitableRole = z.infer<typeof invitableRoleSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  ownerId: z.string(),
  role: workspaceRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const workspaceResponseSchema = z.object({ workspace: workspaceSchema });
export const workspaceListSchema = paginatedSchema(workspaceSchema);

export const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
});
export type Member = z.infer<typeof memberSchema>;
export const memberListSchema = paginatedSchema(memberSchema);
export type MemberList = z.infer<typeof memberListSchema>;
export const memberResponseSchema = z.object({ member: memberSchema });

export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: invitableRoleSchema,
  invitedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type Invitation = z.infer<typeof invitationSchema>;
export const invitationListSchema = paginatedSchema(invitationSchema);
export const createdInvitationSchema = z.object({ invitation: invitationSchema, token: z.string() });

export const invitationPreviewSchema = z.object({
  workspaceName: z.string(),
  email: z.string(),
  role: invitableRoleSchema,
  invitedByName: z.string().nullable(),
  expiresAt: z.string(),
  status: z.enum(['pending', 'accepted', 'expired']),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export const invitationPreviewResponseSchema = z.object({ invitation: invitationPreviewSchema });
