import argon2 from 'argon2';

/** OWASP minimum recommended Argon2id parameters (19 MiB memory, 2 iterations, 1 lane). */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed stored hash must never authenticate.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Performs a verification against a throwaway hash so that "unknown email" takes about
 * as long as "wrong password", preventing account enumeration through response timing.
 */
export async function simulatePasswordVerification(password: string): Promise<void> {
  dummyHash ??= hashPassword('teamflow-timing-equaliser');
  await verifyPassword(await dummyHash, password);
}
