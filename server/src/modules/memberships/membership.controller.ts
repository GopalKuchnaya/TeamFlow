import type { Request, Response } from 'express';
import { requireUser } from '../../utils/request.js';
import { parseInput } from '../../utils/validation.js';
import { workspaceParamsSchema } from '../workspaces/workspace.schemas.js';
import { listMembersQuerySchema, memberParamsSchema, updateMemberRoleSchema } from './membership.schemas.js';
import * as membershipService from './membership.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  const query = parseInput(listMembersQuerySchema, req.query);
  res.json(await membershipService.listMembers(requireUser(req).id, workspaceId, query));
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const { workspaceId, userId } = parseInput(memberParamsSchema, req.params);
  const input = parseInput(updateMemberRoleSchema, req.body);
  res.json({ member: await membershipService.updateMemberRole(requireUser(req).id, workspaceId, userId, input) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { workspaceId, userId } = parseInput(memberParamsSchema, req.params);
  await membershipService.removeMember(requireUser(req).id, workspaceId, userId);
  res.status(204).end();
}
