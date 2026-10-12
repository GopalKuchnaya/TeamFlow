import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/app-error.js';

interface LimiterOptions {
  windowMs: number;
  limit: number;
  enabled: boolean;
  keyGenerator?: (req: Parameters<RequestHandler>[0]) => string;
}

function createLimiter({ windowMs, limit, enabled, keyGenerator }: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !enabled,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
    },
  });
}

function clientIp(req: Parameters<RequestHandler>[0]): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}

function emailFromBody(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'email' in body && typeof body.email === 'string') {
    return body.email.trim().toLowerCase().slice(0, 254);
  }
  return '';
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Rate limiters are created per app instance so every test app starts with clean counters. */
export function createAuthRateLimiters(enabled: boolean) {
  return {
    loginPerAccount: createLimiter({
      windowMs: FIFTEEN_MINUTES,
      limit: 10,
      enabled,
      keyGenerator: (req) => `${clientIp(req)}|${emailFromBody(req.body)}`,
    }),
    loginPerIp: createLimiter({ windowMs: FIFTEEN_MINUTES, limit: 100, enabled }),
    register: createLimiter({ windowMs: ONE_HOUR, limit: 20, enabled }),
    refresh: createLimiter({ windowMs: FIFTEEN_MINUTES, limit: 60, enabled }),
  };
}

export type AuthRateLimiters = ReturnType<typeof createAuthRateLimiters>;
