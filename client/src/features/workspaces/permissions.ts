import type { InvitableRole, WorkspaceRole } from '@/types/api';

// Mirrors server/src/modules/workspaces/workspace.policy.ts so the UI only offers actions the
// server will accept. The server remains the authority and rejects anything else.
export const permissions = {
  updateWorkspace: (role: WorkspaceRole) => role === 'owner',
  deleteWorkspace: (role: WorkspaceRole) => role === 'owner',
  transferOwnership: (role: WorkspaceRole) => role === 'owner',
  manageInvitations: (role: WorkspaceRole) => role === 'owner' || role === 'admin',
  changeRoles: (role: WorkspaceRole) => role === 'owner',
  leave: (role: WorkspaceRole) => role !== 'owner',
};

export function invitableRoles(role: WorkspaceRole): InvitableRole[] {
  if (role === 'owner') return ['member', 'admin'];
  if (role === 'admin') return ['member'];
  return [];
}

export function canRemoveMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole, isSelf: boolean): boolean {
  if (isSelf) return actorRole !== 'owner';
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole === 'member';
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const ROLE_COLORS: Record<WorkspaceRole, string> = {
  owner: 'purple',
  admin: 'blue',
  member: 'gray',
};
