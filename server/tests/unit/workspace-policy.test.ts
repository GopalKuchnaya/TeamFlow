import { describe, expect, it } from 'vitest';
import type { WorkspaceRole } from '../../src/modules/memberships/membership.model.js';
import { can, canChangeRole, canInviteWithRole, canRemoveMember, type WorkspaceAction } from '../../src/modules/workspaces/workspace.policy.js';
import { slugify, generateSlug } from '../../src/modules/workspaces/slug.js';

// Mirrors the permission matrix in docs/architecture.md §6.
const expected: Record<WorkspaceAction, Record<WorkspaceRole, boolean>> = {
  'workspace.view': { owner: true, admin: true, member: true },
  'workspace.update': { owner: true, admin: false, member: false },
  'workspace.delete': { owner: true, admin: false, member: false },
  'workspace.transferOwnership': { owner: true, admin: false, member: false },
  'members.view': { owner: true, admin: true, member: true },
  'members.updateRole': { owner: true, admin: false, member: false },
  'invitations.view': { owner: true, admin: true, member: false },
  'invitations.create': { owner: true, admin: true, member: false },
  'invitations.revoke': { owner: true, admin: true, member: false },
};

describe('workspace permission matrix', () => {
  for (const [action, byRole] of Object.entries(expected) as [WorkspaceAction, Record<WorkspaceRole, boolean>][]) {
    for (const [role, allowed] of Object.entries(byRole) as [WorkspaceRole, boolean][]) {
      it(`${role} ${allowed ? 'can' : 'cannot'} ${action}`, () => {
        expect(can(role, action)).toBe(allowed);
      });
    }
  }

  it('limits which roles can be granted by invitation', () => {
    expect(canInviteWithRole('owner', 'admin')).toBe(true);
    expect(canInviteWithRole('owner', 'member')).toBe(true);
    expect(canInviteWithRole('admin', 'member')).toBe(true);
    expect(canInviteWithRole('admin', 'admin')).toBe(false);
    expect(canInviteWithRole('member', 'member')).toBe(false);
  });

  it('only lets the owner change roles of other non-owners', () => {
    const owner = { userId: 'o', role: 'owner' as const };
    expect(canChangeRole(owner, { userId: 'a', role: 'admin' })).toBe(true);
    expect(canChangeRole(owner, { userId: 'm', role: 'member' })).toBe(true);
    expect(canChangeRole(owner, owner)).toBe(false);
    expect(canChangeRole({ userId: 'a', role: 'admin' }, { userId: 'm', role: 'member' })).toBe(false);
  });

  it('applies removal and leave rules', () => {
    const owner = { userId: 'o', role: 'owner' as const };
    const admin = { userId: 'a', role: 'admin' as const };
    const admin2 = { userId: 'a2', role: 'admin' as const };
    const member = { userId: 'm', role: 'member' as const };
    expect(canRemoveMember(owner, admin)).toBe(true);
    expect(canRemoveMember(owner, member)).toBe(true);
    expect(canRemoveMember(owner, owner)).toBe(false); // owner must transfer before leaving
    expect(canRemoveMember(admin, member)).toBe(true);
    expect(canRemoveMember(admin, admin2)).toBe(false);
    expect(canRemoveMember(admin, owner)).toBe(false);
    expect(canRemoveMember(admin, admin)).toBe(true); // leave
    expect(canRemoveMember(member, member)).toBe(true); // leave
    expect(canRemoveMember(member, { userId: 'm2', role: 'member' })).toBe(false);
  });
});

describe('slugs', () => {
  it('produces URL-safe slugs', () => {
    expect(slugify('  Ácme Design — Team #1 ')).toBe('acme-design-team-1');
    expect(slugify('!!!')).toBe('workspace');
    expect(generateSlug('Acme')).toMatch(/^acme-[a-f0-9]{6}$/);
  });
});
