import { AppError } from '../../utils/app-error.js';
import { isDuplicateKeyError } from '../../utils/mongo.js';
import { paginated, skipFor, type Paginated, type PaginationQuery } from '../../utils/pagination.js';
import { withOptionalTransaction } from '../../utils/transaction.js';
import { InvitationModel } from '../invitations/invitation.model.js';
import { authorize } from '../memberships/membership.service.js';
import { MembershipModel } from '../memberships/membership.model.js';
import { toWorkspaceDto, type WorkspaceDto } from './workspace.dto.js';
import { WorkspaceModel, type WorkspaceDocument } from './workspace.model.js';
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from './workspace.schemas.js';
import { generateSlug } from './slug.js';

const SLUG_ATTEMPTS = 3;

async function loadWorkspace(workspaceId: string): Promise<WorkspaceDocument> {
  const workspace = await WorkspaceModel.findById(workspaceId).exec();
  if (!workspace) throw AppError.notFound('Workspace not found');
  return workspace;
}

/** Workspaces the caller belongs to, most recently joined first. */
export async function listWorkspaces(actorId: string, query: PaginationQuery): Promise<Paginated<WorkspaceDto>> {
  const [memberships, total] = await Promise.all([
    MembershipModel.find({ userId: actorId })
      .sort({ joinedAt: -1, _id: -1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .select('workspaceId role')
      .lean()
      .exec(),
    MembershipModel.countDocuments({ userId: actorId }).exec(),
  ]);

  const workspaces = await WorkspaceModel.find({ _id: { $in: memberships.map((m) => m.workspaceId) } })
    .lean()
    .exec();
  const byId = new Map(workspaces.map((workspace) => [workspace._id.toString(), workspace]));

  const items = memberships.flatMap((membership) => {
    const workspace = byId.get(membership.workspaceId.toString());
    return workspace ? [toWorkspaceDto(workspace, membership.role)] : [];
  });
  return paginated(items, total, query);
}

/**
 * Creates the workspace and its owner membership. Without transactions the membership
 * insert is compensated by deleting the workspace; a workspace without memberships is
 * unreachable anyway, because every read goes through a membership.
 */
export async function createWorkspace(actorId: string, input: CreateWorkspaceInput): Promise<WorkspaceDto> {
  return withOptionalTransaction(async (session) => {
    let workspace: WorkspaceDocument | undefined;
    for (let attempt = 1; !workspace; attempt += 1) {
      try {
        [workspace] = await WorkspaceModel.create(
          [{ name: input.name, description: input.description, slug: generateSlug(input.name), ownerId: actorId }],
          { session },
        );
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt >= SLUG_ATTEMPTS) throw error;
      }
    }

    try {
      await MembershipModel.create([{ workspaceId: workspace._id, userId: actorId, role: 'owner' }], { session });
    } catch (error) {
      if (!session) await WorkspaceModel.deleteOne({ _id: workspace._id }).exec();
      throw error;
    }
    return toWorkspaceDto(workspace, 'owner');
  });
}

export async function getWorkspace(actorId: string, workspaceId: string): Promise<WorkspaceDto> {
  const access = await authorize(workspaceId, actorId, 'workspace.view');
  return toWorkspaceDto(await loadWorkspace(workspaceId), access.role);
}

export async function updateWorkspace(
  actorId: string,
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceDto> {
  const access = await authorize(workspaceId, actorId, 'workspace.update');
  const workspace = await WorkspaceModel.findByIdAndUpdate(
    workspaceId,
    {
      $set: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).exec();
  if (!workspace) throw AppError.notFound('Workspace not found');
  return toWorkspaceDto(workspace, access.role);
}

/**
 * Deletes a workspace and everything scoped to it. Access-granting rows (memberships) go
 * first, so a partial failure without transactions leaves an unreachable workspace rather
 * than members of a half-deleted one. Later phases add projects, tasks, etc. here.
 */
export async function deleteWorkspace(actorId: string, workspaceId: string): Promise<void> {
  await authorize(workspaceId, actorId, 'workspace.delete');
  await withOptionalTransaction(async (session) => {
    await MembershipModel.deleteMany({ workspaceId }, { session }).exec();
    await InvitationModel.deleteMany({ workspaceId }, { session }).exec();
    await WorkspaceModel.deleteOne({ _id: workspaceId }, { session }).exec();
  });
}

/**
 * Makes another member the owner; the previous owner becomes an admin. Without
 * transactions the order (promote, re-point, demote) means a failure can leave two owners
 * temporarily but never zero.
 */
export async function transferOwnership(
  actorId: string,
  workspaceId: string,
  newOwnerId: string,
): Promise<WorkspaceDto> {
  await authorize(workspaceId, actorId, 'workspace.transferOwnership');
  if (newOwnerId === actorId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'You already own this workspace', [
      { path: 'userId', message: 'Choose another member' },
    ]);
  }
  const target = await MembershipModel.findOne({ workspaceId, userId: newOwnerId }).select('role').lean().exec();
  if (!target) throw AppError.notFound('Member not found');
  if (target.role === 'owner') throw AppError.forbidden();

  await withOptionalTransaction(async (session) => {
    await MembershipModel.updateOne({ workspaceId, userId: newOwnerId }, { $set: { role: 'owner' } }, { session }).exec();
    await WorkspaceModel.updateOne({ _id: workspaceId }, { $set: { ownerId: newOwnerId } }, { session }).exec();
    await MembershipModel.updateOne(
      { workspaceId, userId: actorId, role: 'owner' },
      { $set: { role: 'admin' } },
      { session },
    ).exec();
  });

  return toWorkspaceDto(await loadWorkspace(workspaceId), 'admin');
}
