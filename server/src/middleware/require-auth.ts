import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/auth/token.service.js';
import { findUserById } from '../modules/users/user.service.js';
import { AppError } from '../utils/app-error.js';

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Verifies the access token and loads the user on every request, so a deleted account
 * loses access immediately rather than when its token expires.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = extractBearerToken(req.get('authorization'));
  if (!token) throw AppError.unauthenticated();

  const userId = verifyAccessToken(token);
  const user = await findUserById(userId);
  if (!user) throw AppError.unauthenticated();

  req.user = { id: user._id.toString(), name: user.name, email: user.email };
  next();
};
