import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv } from '../../src/config/env.js';
import { signAccessToken, verifyAccessToken } from '../../src/modules/auth/token.service.js';
import { AppError } from '../../src/utils/app-error.js';

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}

describe('access tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips the user id', () => {
    const { token, expiresIn } = signAccessToken('507f1f77bcf86cd799439011');
    expect(expiresIn).toBe(getEnv().ACCESS_TOKEN_TTL_SECONDS);
    expect(verifyAccessToken(token)).toBe('507f1f77bcf86cd799439011');
  });

  it('reports expiry with a distinct TOKEN_EXPIRED code', () => {
    vi.useFakeTimers();
    const { token } = signAccessToken('507f1f77bcf86cd799439011');
    vi.advanceTimersByTime((getEnv().ACCESS_TOKEN_TTL_SECONDS + 1) * 1000);
    const error = captureError(() => verifyAccessToken(token));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens signed with another secret', () => {
    const forged = jwt.sign({}, 'another-secret-another-secret-another', {
      subject: 'x',
      issuer: getEnv().JWT_ISSUER,
      audience: getEnv().JWT_AUDIENCE,
    });
    expect((captureError(() => verifyAccessToken(forged)) as AppError).code).toBe('UNAUTHENTICATED');
  });

  it('rejects unsigned (alg=none) tokens', () => {
    const unsigned = jwt.sign({ sub: 'x', iss: getEnv().JWT_ISSUER, aud: getEnv().JWT_AUDIENCE }, '', {
      algorithm: 'none',
    });
    expect((captureError(() => verifyAccessToken(unsigned)) as AppError).code).toBe('UNAUTHENTICATED');
  });

  it('rejects tokens for a different audience', () => {
    const token = jwt.sign({}, getEnv().JWT_ACCESS_SECRET, {
      subject: 'x',
      issuer: getEnv().JWT_ISSUER,
      audience: 'someone-else',
    });
    expect((captureError(() => verifyAccessToken(token)) as AppError).code).toBe('UNAUTHENTICATED');
  });
});
