import type { Request, Response } from 'express';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { requireUser } from '../../utils/request.js';
import { parseInput } from '../../utils/validation.js';
import {
  createWorkspaceSchema,
  transferOwnershipSchema,
  updateWorkspaceSchema,
  workspaceParamsSchema,
} from './workspace.schemas.js';
import * as workspaceService from './workspace.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseInput(paginationQuerySchema, req.query);
  res.json(await workspaceService.listWorkspaces(requireUser(req).id, query));
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = parseInput(createWorkspaceSchema, req.body);
  res.status(201).json({ workspace: await workspaceService.createWorkspace(requireUser(req).id, input) });
}

export async function get(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  res.json({ workspace: await workspaceService.getWorkspace(requireUser(req).id, workspaceId) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  const input = parseInput(updateWorkspaceSchema, req.body);
  res.json({ workspace: await workspaceService.updateWorkspace(requireUser(req).id, workspaceId, input) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  await workspaceService.deleteWorkspace(requireUser(req).id, workspaceId);
  res.status(204).end();
}

export async function transferOwnership(req: Request, res: Response): Promise<void> {
  const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
  const { userId } = parseInput(transferOwnershipSchema, req.body);
  res.json({ workspace: await workspaceService.transferOwnership(requireUser(req).id, workspaceId, userId) });
}
