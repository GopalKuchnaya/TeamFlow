import type { Types } from 'mongoose';
import type { WorkspaceRole } from './membership.model.js';

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

interface MembershipLike {
  userId: Types.ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
}

interface MemberUserLike {
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export function toMemberDto(membership: MembershipLike, user: MemberUserLike): MemberDto {
  return {
    userId: membership.userId.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    role: membership.role,
    joinedAt: membership.joinedAt.toISOString(),
  };
}
