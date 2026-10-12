import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'teamflow';

/**
 * Guards cookie-authenticated endpoints. Browsers cannot attach a custom header to a
 * cross-origin request without a CORS preflight, which only allowlisted origins pass.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    next(new AppError(403, 'CSRF_HEADER_MISSING', 'Missing required request header'));
    return;
  }
  next();
};
