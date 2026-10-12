import { pino, type Logger } from 'pino';
import { getEnv } from './env.js';

/** Paths that must never reach log output. */
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
];

function createLogger(): Logger {
  const env = getEnv();
  return pino({
    level: env.LOG_LEVEL,
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}

let cachedLogger: Logger | undefined;

export function getLogger(): Logger {
  cachedLogger ??= createLogger();
  return cachedLogger;
}
