import type { Request } from 'express';
import type { AuthUser } from '../modules/auth/auth.types.js';
import { AppError } from './app-error.js';

/** The authenticated user set by `requireAuth`. Throws if a route forgot the middleware. */
export function requireUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthenticated();
  return req.user;
}
