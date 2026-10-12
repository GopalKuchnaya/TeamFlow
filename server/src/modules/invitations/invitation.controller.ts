import type { Request, Response } from 'express';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { requireUser } from '../../utils/request.js';
import { parseInput } from '../../utils/validation.js';
import { workspaceParamsSchema } from '../workspaces/workspace.schemas.js';
import { createInvitationSchema, invitationParamsSchema, invitationTokenSchema } from './invitation.schemas.js';
import * as invitationService from './invitation.service.js';

export async function create(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  const input = parseInput(createInvitationSchema, req.body);
  res.status(201).json(await invitationService.createInvitation(requireUser(req), workspaceId, input));
}

export async function list(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  const query = parseInput(paginationQuerySchema, req.query);
  res.json(await invitationService.listInvitations(requireUser(req).id, workspaceId, query));
}

export async function revoke(req: Request, res: Response): Promise<void> {
  const { workspaceId, invitationId } = parseInput(invitationParamsSchema, req.params);
  await invitationService.revokeInvitation(requireUser(req).id, workspaceId, invitationId);
  res.status(204).end();
}

export async function preview(req: Request, res: Response): Promise<void> {
  const { token } = parseInput(invitationTokenSchema, req.body);
  res.json({ invitation: await invitationService.previewInvitation(token) });
}

export async function accept(req: Request, res: Response): Promise<void> {
  const { token } = parseInput(invitationTokenSchema, req.body);
  res.json({ workspace: await invitationService.acceptInvitation(requireUser(req), token) });
}
