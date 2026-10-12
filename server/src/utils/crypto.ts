import { createHash, randomBytes } from 'node:crypto';

/** Generates a URL-safe random token with 256 bits of entropy. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes a high-entropy token for storage. A fast hash is appropriate here (unlike for
 * passwords) because the input is 256 random bits and cannot be brute-forced.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
