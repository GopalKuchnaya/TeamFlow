import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import { parseInput } from '../../utils/validation.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookies.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import type { AuthResult } from './auth.service.js';
import type { RequestContext } from './auth.types.js';

function requestContext(req: Request): RequestContext {
  return { userAgent: req.get('user-agent') };
}

/** The refresh token only ever travels in the HttpOnly cookie, never in the JSON body. */
function sendSession(res: Response, status: number, result: AuthResult): void {
  setRefreshCookie(res, result.refreshToken.token, result.refreshToken.expiresAt);
  res.status(status).json({
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = parseInput(registerSchema, req.body);
  sendSession(res, 201, await authService.register(input, requestContext(req)));
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = parseInput(loginSchema, req.body);
  sendSession(res, 200, await authService.login(input, requestContext(req)));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.refresh(readRefreshCookie(req.cookies), requestContext(req), req.log);
    sendSession(res, 200, result);
  } catch (error) {
    // A dead session must not leave a stale cookie behind.
    if (error instanceof AppError && error.code === 'INVALID_REFRESH_TOKEN') clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req.cookies));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthenticated();
  res.json({ user: await authService.getCurrentUser(req.user.id) });
}
