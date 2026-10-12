import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { getEnv } from './config/env.js';
import { getLogger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAuthRateLimiters, createInvitationRateLimiters } from './middleware/rate-limit.js';
import { CSRF_HEADER } from './middleware/require-csrf-header.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createInvitationRouter } from './modules/invitations/invitation.routes.js';
import { createWorkspaceRouter } from './modules/workspaces/workspace.routes.js';

export const API_PREFIX = '/api/v1';
const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/** Builds the Express application without binding a port, so tests can drive it directly. */
export function createApp(): Express {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger: getLogger(),
      genReqId: (req, res) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: { ignore: (req) => req.url.startsWith(`${API_PREFIX}/health`) },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER, REQUEST_ID_HEADER],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const authLimiters = createAuthRateLimiters(env.RATE_LIMIT_ENABLED);
  app.use(`${API_PREFIX}/health`, createHealthRouter());
  app.use(`${API_PREFIX}/auth`, createAuthRouter(authLimiters));
  const invitationLimiters = createInvitationRateLimiters(env.RATE_LIMIT_ENABLED);
  app.use(`${API_PREFIX}/workspaces`, createWorkspaceRouter(invitationLimiters));
  app.use(`${API_PREFIX}/invitations`, createInvitationRouter(invitationLimiters));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
