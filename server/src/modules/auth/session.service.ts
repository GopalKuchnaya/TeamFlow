import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { getEnv } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { generateOpaqueToken, hashToken } from '../../utils/crypto.js';
import type { RequestContext } from './auth.types.js';
import { SessionModel } from './session.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

function invalidRefreshToken(): AppError {
  return new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid or has expired');
}

function truncateUserAgent(userAgent: string | undefined): string | undefined {
  return userAgent?.slice(0, 256);
}

/** Starts a new session (token family) or continues an existing family after rotation. */
export async function issueRefreshToken(
  userId: string,
  context: RequestContext,
  familyId: string = randomUUID(),
): Promise<IssuedRefreshToken> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + getEnv().REFRESH_TOKEN_TTL_DAYS * DAY_MS);
  await SessionModel.create({
    userId,
    familyId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: truncateUserAgent(context.userAgent),
  });
  return { token, expiresAt };
}

async function revokeFamily(familyId: string, reason: 'logout' | 'reuse_detected'): Promise<void> {
  await SessionModel.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  ).exec();
}

/**
 * Exchanges a refresh token for a new one (rotation).
 *
 * - An active token is atomically marked as rotated, so two concurrent requests cannot
 *   both rotate it.
 * - A token rotated within the grace window (parallel tabs) gets a sibling token, as long
 *   as the family is still alive.
 * - A rotated token presented after the grace window means it was replayed: the whole
 *   family is revoked.
 */
export async function rotateRefreshToken(
  rawToken: string,
  context: RequestContext,
  logger: Logger,
): Promise<{ userId: string; refreshToken: IssuedRefreshToken }> {
  const now = new Date();
  const tokenHash = hashToken(rawToken);

  const active = await SessionModel.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokedReason: 'rotated' } },
  ).exec();

  if (active) {
    const userId = active.userId.toString();
    return { userId, refreshToken: await issueRefreshToken(userId, context, active.familyId) };
  }

  const existing = await SessionModel.findOne({ tokenHash }).exec();
  if (!existing || existing.expiresAt <= now || existing.revokedReason !== 'rotated' || !existing.revokedAt) {
    throw invalidRefreshToken();
  }

  const graceMs = getEnv().REFRESH_REUSE_GRACE_SECONDS * 1000;
  const withinGrace = now.getTime() - existing.revokedAt.getTime() <= graceMs;
  if (withinGrace) {
    const familyAlive = await SessionModel.exists({
      familyId: existing.familyId,
      revokedAt: null,
      expiresAt: { $gt: now },
    }).exec();
    if (familyAlive) {
      const userId = existing.userId.toString();
      return { userId, refreshToken: await issueRefreshToken(userId, context, existing.familyId) };
    }
    throw invalidRefreshToken();
  }

  logger.warn(
    { userId: existing.userId.toString(), familyId: existing.familyId },
    'Refresh token reuse detected; revoking session family',
  );
  await revokeFamily(existing.familyId, 'reuse_detected');
  throw invalidRefreshToken();
}

/** Revokes the session family of the given token. Unknown tokens are ignored (idempotent). */
export async function revokeSessionByToken(rawToken: string): Promise<void> {
  const session = await SessionModel.findOne({ tokenHash: hashToken(rawToken) })
    .select('familyId')
    .exec();
  if (session) await revokeFamily(session.familyId, 'logout');
}
