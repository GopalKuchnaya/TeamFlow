import { Router } from 'express';
import type { InvitationRateLimiters } from '../../middleware/rate-limit.js';
import { requireAuth } from '../../middleware/require-auth.js';
import * as controller from './invitation.controller.js';

export function createInvitationRouter(limiters: InvitationRateLimiters): Router {
  const router = Router();
  // Public: lets a signed-out invitee see what they were invited to before signing up.
  router.post('/preview', limiters.redeem, controller.preview);
  router.post('/accept', limiters.redeem, requireAuth, controller.accept);
  return router;
}
