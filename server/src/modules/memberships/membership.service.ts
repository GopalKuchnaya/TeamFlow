import { Types } from 'mongoose';
import { AppError } from '../../utils/app-error.js';
import { paginated, skipFor, type Paginated } from '../../utils/pagination.js';
import { UserModel } from '../users/user.model.js';
import { can, canChangeRole, canRemoveMember, type WorkspaceAction } from '../workspaces/workspace.policy.js';
import { toMemberDto, type MemberDto } from './membership.dto.js';
import { MembershipModel, type WorkspaceRole } from './membership.model.js';
import type { ListMembersQuery, UpdateMemberRoleInput } from './membership.schemas.js';

/** The caller's verified relationship to a workspace. */
export interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

function workspaceNotFound(): AppError {
  return AppError.notFound('Workspace not found');
}

/**
 * The single workspace access check. Non-members get 404 (not 403) so the existence of
 * other workspaces is never revealed. The client-supplied id is only a lookup key: access
 * is proven by the membership row.
 */
export async function getMembershipOrThrow(workspaceId: string, userId: string): Promise<WorkspaceAccess> {
  if (!Types.ObjectId.isValid(workspaceId)) throw workspaceNotFound();
  const membership = await MembershipModel.findOne({ workspaceId, userId }).select('role').lean().exec();
  if (!membership) throw workspaceNotFound();
  return { workspaceId, userId, role: membership.role };
}

export function assertCan(access: WorkspaceAccess, action: WorkspaceAction): void {
  if (!can(access.role, action)) throw AppError.forbidden();
}

/** Loads the access record and asserts a permission in one step. */
export async function authorize(
  workspaceId: string,
  userId: string,
  action: WorkspaceAction,
): Promise<WorkspaceAccess> {
  const access = await getMembershipOrThrow(workspaceId, userId);
  assertCan(access, action);
  return access;
}

export async function listMembers(
  actorId: string,
  workspaceId: string,
  query: ListMembersQuery,
): Promise<Paginated<MemberDto>> {
  await authorize(workspaceId, actorId, 'members.view');

  const filter = { workspaceId, ...(query.role ? { role: query.role } : {}) };
  const [memberships, total] = await Promise.all([
    MembershipModel.find(filter)
      .sort({ joinedAt: 1, _id: 1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .lean()
      .exec(),
    MembershipModel.countDocuments(filter).exec(),
  ]);

  // One query for all users on the page (no N+1).
  const users = await UserModel.find({ _id: { $in: memberships.map((m) => m.userId) } })
    .select('name email avatarUrl')
    .lean()
    .exec();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  const items = memberships.flatMap((membership) => {
    const user = usersById.get(membership.userId.toString());
    return user ? [toMemberDto(membership, user)] : [];
  });
  return paginated(items, total, query);
}

async function loadTargetMembership(workspaceId: string, userId: string) {
  const target = await MembershipModel.findOne({ workspaceId, userId }).exec();
  if (!target) throw AppError.notFound('Member not found');
  return target;
}

async function toMemberDtoForUser(membership: Parameters<typeof toMemberDto>[0]): Promise<MemberDto> {
  const user = await UserModel.findById(membership.userId).select('name email avatarUrl').lean().exec();
  if (!user) throw AppError.notFound('Member not found');
  return toMemberDto(membership, user);
}

export async function updateMemberRole(
  actorId: string,
  workspaceId: string,
  targetUserId: string,
  input: UpdateMemberRoleInput,
): Promise<MemberDto> {
  const actor = await authorize(workspaceId, actorId, 'members.updateRole');
  const target = await loadTargetMembership(workspaceId, targetUserId);
  if (!canChangeRole(actor, { userId: targetUserId, role: target.role })) throw AppError.forbidden();

  // The role guard in the filter makes the owner row immutable even under concurrent requests.
  const updated = await MembershipModel.findOneAndUpdate(
    { _id: target._id, role: { $ne: 'owner' } },
    { $set: { role: input.role } },
    { returnDocument: 'after' },
  ).exec();
  if (!updated) throw AppError.forbidden();
  return toMemberDtoForUser(updated);
}

/** Removes a member, or lets a non-owner leave when `targetUserId` is the caller. */
export async function removeMember(actorId: string, workspaceId: string, targetUserId: string): Promise<void> {
  const actor = await getMembershipOrThrow(workspaceId, actorId);
  const target = actorId === targetUserId ? actor : await loadTargetMembership(workspaceId, targetUserId);
  if (!canRemoveMember(actor, { userId: targetUserId, role: target.role })) throw AppError.forbidden();

  await MembershipModel.deleteOne({ workspaceId, userId: targetUserId, role: { $ne: 'owner' } }).exec();
}
