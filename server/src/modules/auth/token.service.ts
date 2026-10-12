import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

const ALGORITHM = 'HS256';

export interface AccessToken {
  token: string;
  expiresIn: number;
}

export function signAccessToken(userId: string): AccessToken {
  const env = getEnv();
  const token = jwt.sign({}, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
  return { token, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS };
}

/** Returns the user id carried by a valid access token, or throws a 401 AppError. */
export function verifyAccessToken(token: string): string {
  const env = getEnv();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: [ALGORITHM],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw AppError.unauthenticated('Invalid access token');
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    if (error instanceof AppError) throw error;
    throw AppError.unauthenticated('Invalid access token');
  }
}
