import { Router } from 'express';
import type { InvitationRateLimiters } from '../../middleware/rate-limit.js';
import { requireAuth } from '../../middleware/require-auth.js';
import * as invitations from '../invitations/invitation.controller.js';
import * as members from '../memberships/membership.controller.js';
import * as workspaces from './workspace.controller.js';

/**
 * Every route requires authentication; membership and role checks happen in the services
 * (see memberships/membership.service.ts → authorize).
 */
export function createWorkspaceRouter(invitationLimiters: InvitationRateLimiters): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', workspaces.list);
  router.post('/', workspaces.create);
  router.get('/:workspaceId', workspaces.get);
  router.patch('/:workspaceId', workspaces.update);
  router.delete('/:workspaceId', workspaces.remove);
  router.post('/:workspaceId/transfer-ownership', workspaces.transferOwnership);

  router.get('/:workspaceId/members', members.list);
  router.patch('/:workspaceId/members/:userId', members.updateRole);
  router.delete('/:workspaceId/members/:userId', members.remove);

  router.get('/:workspaceId/invitations', invitations.list);
  router.post('/:workspaceId/invitations', invitationLimiters.send, invitations.create);
  router.delete('/:workspaceId/invitations/:invitationId', invitations.revoke);

  return router;
}
