import type { Types } from 'mongoose';
import type { WorkspaceRole } from '../memberships/membership.model.js';

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  /** The caller's role in this workspace. */
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceLike {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export function toWorkspaceDto(workspace: WorkspaceLike, role: WorkspaceRole): WorkspaceDto {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description ?? '',
    ownerId: workspace.ownerId.toString(),
    role,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}
