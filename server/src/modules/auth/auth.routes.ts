import { Router } from 'express';
import type { AuthRateLimiters } from '../../middleware/rate-limit.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireCsrfHeader } from '../../middleware/require-csrf-header.js';
import * as controller from './auth.controller.js';

export function createAuthRouter(limiters: AuthRateLimiters): Router {
  const router = Router();
  router.post('/register', limiters.register, controller.register);
  router.post('/login', limiters.loginPerIp, limiters.loginPerAccount, controller.login);
  router.post('/refresh', limiters.refresh, requireCsrfHeader, controller.refresh);
  router.post('/logout', requireCsrfHeader, controller.logout);
  router.get('/me', requireAuth, controller.me);
  return router;
}
