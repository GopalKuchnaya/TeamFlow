import { AppError } from '../../utils/app-error.js';
import { generateOpaqueToken, hashToken } from '../../utils/crypto.js';
import { isDuplicateKeyError } from '../../utils/mongo.js';
import { paginated, skipFor, type Paginated, type PaginationQuery } from '../../utils/pagination.js';
import type { AuthUser } from '../auth/auth.types.js';
import { MembershipModel } from '../memberships/membership.model.js';
import { authorize } from '../memberships/membership.service.js';
import { UserModel } from '../users/user.model.js';
import { toWorkspaceDto, type WorkspaceDto } from '../workspaces/workspace.dto.js';
import { WorkspaceModel } from '../workspaces/workspace.model.js';
import { canInviteWithRole } from '../workspaces/workspace.policy.js';
import {
  toInvitationDto,
  type InvitationDto,
  type InvitationPreviewDto,
  type InvitationStatus,
} from './invitation.dto.js';
import { InvitationModel, type InvitationDocument } from './invitation.model.js';
import type { CreateInvitationInput } from './invitation.schemas.js';

export const INVITATION_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function pendingFilter(now: Date) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { $gt: now } };
}

function invitationNotFound(): AppError {
  return new AppError(404, 'INVITATION_NOT_FOUND', 'This invitation is invalid or has been revoked');
}

function alreadyMember(): AppError {
  return new AppError(409, 'ALREADY_MEMBER', 'This person is already a member of the workspace');
}

export interface CreatedInvitation {
  invitation: InvitationDto;
  /** Returned exactly once so the inviter can share the link; only its hash is stored. */
  token: string;
}

export async function createInvitation(
  actor: AuthUser,
  workspaceId: string,
  input: CreateInvitationInput,
): Promise<CreatedInvitation> {
  const access = await authorize(workspaceId, actor.id, 'invitations.create');
  if (!canInviteWithRole(access.role, input.role)) {
    throw AppError.forbidden('Admins can only invite members');
  }

  const existingUser = await UserModel.findOne({ email: input.email }).select('_id').lean().exec();
  if (existingUser && (await MembershipModel.exists({ workspaceId, userId: existingUser._id }).exec())) {
    throw alreadyMember();
  }

  const now = new Date();
  // Re-inviting the same email replaces the previous pending link.
  await InvitationModel.updateMany(
    { workspaceId, email: input.email, acceptedAt: null, revokedAt: null },
    { $set: { revokedAt: now } },
  ).exec();

  const token = generateOpaqueToken();
  const invitation = await InvitationModel.create({
    workspaceId,
    email: input.email,
    role: input.role,
    tokenHash: hashToken(token),
    invitedBy: actor.id,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
  });
  return { invitation: toInvitationDto(invitation, actor.name), token };
}

/** Pending (not accepted, revoked, or expired) invitations, newest first. */
export async function listInvitations(
  actorId: string,
  workspaceId: string,
  query: PaginationQuery,
): Promise<Paginated<InvitationDto>> {
  await authorize(workspaceId, actorId, 'invitations.view');
  const filter = { workspaceId, ...pendingFilter(new Date()) };
  const [invitations, total] = await Promise.all([
    InvitationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skipFor(query)).limit(query.limit).lean().exec(),
    InvitationModel.countDocuments(filter).exec(),
  ]);
  const inviters = await UserModel.find({ _id: { $in: invitations.map((i) => i.invitedBy) } })
    .select('name')
    .lean()
    .exec();
  const names = new Map(inviters.map((user) => [user._id.toString(), user.name]));
  return paginated(
    invitations.map((invitation) => toInvitationDto(invitation, names.get(invitation.invitedBy.toString()))),
    total,
    query,
  );
}

export async function revokeInvitation(actorId: string, workspaceId: string, invitationId: string): Promise<void> {
  await authorize(workspaceId, actorId, 'invitations.revoke');
  const revoked = await InvitationModel.findOneAndUpdate(
    { _id: invitationId, workspaceId, acceptedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).exec();
  if (!revoked) throw invitationNotFound();
}

function statusOf(invitation: InvitationDocument, now: Date): InvitationStatus {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.expiresAt <= now) return 'expired';
  return 'pending';
}

async function findByToken(token: string): Promise<InvitationDocument> {
  const invitation = await InvitationModel.findOne({ tokenHash: hashToken(token) }).exec();
  if (!invitation || invitation.revokedAt) throw invitationNotFound();
  return invitation;
}

export async function previewInvitation(token: string): Promise<InvitationPreviewDto> {
  const invitation = await findByToken(token);
  const [workspace, inviter] = await Promise.all([
    WorkspaceModel.findById(invitation.workspaceId).select('name').lean().exec(),
    UserModel.findById(invitation.invitedBy).select('name').lean().exec(),
  ]);
  if (!workspace) throw invitationNotFound();
  return {
    workspaceName: workspace.name,
    email: invitation.email,
    role: invitation.role,
    invitedByName: inviter?.name ?? null,
    expiresAt: invitation.expiresAt.toISOString(),
    status: statusOf(invitation, new Date()),
  };
}

/**
 * Accepts an invitation for the signed-in user. The token proves the link was received and
 * the email match proves it was meant for this account. A conditional update claims the
 * invitation atomically, so it can be used once even under concurrent requests.
 */
export async function acceptInvitation(user: AuthUser, token: string): Promise<WorkspaceDto> {
  const invitation = await findByToken(token);
  const now = new Date();
  const status = statusOf(invitation, now);
  if (status === 'accepted') {
    throw new AppError(409, 'INVITATION_ALREADY_USED', 'This invitation has already been used');
  }
  if (status === 'expired') {
    throw new AppError(410, 'INVITATION_EXPIRED', 'This invitation has expired. Ask for a new one.');
  }
  if (invitation.email !== user.email) {
    throw new AppError(
      403,
      'INVITATION_EMAIL_MISMATCH',
      'This invitation was sent to a different email address. Sign in with that account to accept it.',
    );
  }
  const { workspaceId } = invitation;
  if (await MembershipModel.exists({ workspaceId, userId: user.id }).exec()) throw alreadyMember();

  const claimed = await InvitationModel.findOneAndUpdate(
    { _id: invitation._id, ...pendingFilter(now) },
    { $set: { acceptedAt: now, acceptedBy: user.id } },
  ).exec();
  if (!claimed) throw new AppError(409, 'INVITATION_ALREADY_USED', 'This invitation has already been used');

  try {
    await MembershipModel.create({ workspaceId, userId: user.id, role: invitation.role });
  } catch (error) {
    // Release the claim so a failed join does not burn the invitation.
    await InvitationModel.updateOne({ _id: invitation._id }, { $set: { acceptedAt: null, acceptedBy: null } }).exec();
    if (isDuplicateKeyError(error)) throw alreadyMember();
    throw error;
  }

  const workspace = await WorkspaceModel.findById(workspaceId).exec();
  if (!workspace) {
    // The workspace was deleted between the checks above and now.
    await MembershipModel.deleteOne({ workspaceId, userId: user.id }).exec();
    throw invitationNotFound();
  }
  return toWorkspaceDto(workspace, invitation.role);
}
