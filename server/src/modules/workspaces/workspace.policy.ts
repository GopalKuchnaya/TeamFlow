import type { InvitableRole } from '../invitations/invitation.model.js';
import type { WorkspaceRole } from '../memberships/membership.model.js';

/**
 * Workspace authorization rules (docs/architecture.md §6). Pure functions: no I/O, so every
 * rule is unit-testable and shared by REST services and (later) Socket.io handlers.
 */
export type WorkspaceAction =
  | 'workspace.view'
  | 'workspace.update'
  | 'workspace.delete'
  | 'workspace.transferOwnership'
  | 'members.view'
  | 'members.updateRole'
  | 'invitations.view'
  | 'invitations.create'
  | 'invitations.revoke';

const MATRIX: Record<WorkspaceAction, readonly WorkspaceRole[]> = {
  'workspace.view': ['owner', 'admin', 'member'],
  'workspace.update': ['owner'],
  'workspace.delete': ['owner'],
  'workspace.transferOwnership': ['owner'],
  'members.view': ['owner', 'admin', 'member'],
  'members.updateRole': ['owner'],
  'invitations.view': ['owner', 'admin'],
  'invitations.create': ['owner', 'admin'],
  'invitations.revoke': ['owner', 'admin'],
};

export function can(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return MATRIX[action].includes(role);
}

/** Owners may invite admins or members; admins may invite members only. */
export function canInviteWithRole(actorRole: WorkspaceRole, inviteRole: InvitableRole): boolean {
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && inviteRole === 'member';
}

export interface MemberRef {
  userId: string;
  role: WorkspaceRole;
}

/** Only the owner changes roles, never their own, never the owner role (use ownership transfer). */
export function canChangeRole(actor: MemberRef, target: MemberRef): boolean {
  return actor.role === 'owner' && actor.userId !== target.userId && target.role !== 'owner';
}

/**
 * Anyone but the owner may leave. The owner may remove anyone else; admins may remove
 * members only.
 */
export function canRemoveMember(actor: MemberRef, target: MemberRef): boolean {
  if (actor.userId === target.userId) return actor.role !== 'owner';
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && target.role === 'member';
}
