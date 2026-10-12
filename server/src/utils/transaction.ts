import mongoose, { type ClientSession } from 'mongoose';

let supportsTransactions: Promise<boolean> | undefined;

async function detectTransactionSupport(): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) return false;
  const hello: { setName?: unknown; msg?: unknown } = await db.admin().command({ hello: 1 });
  // Transactions need a replica set member or a mongos router; standalone servers reject them.
  return typeof hello.setName === 'string' || hello.msg === 'isdbgrid';
}

/**
 * Runs `work` inside a transaction when the deployment supports one; otherwise runs it
 * without a session. Callers must therefore order their writes so that a partial failure
 * in the fallback path leaves data in a safe state (see docs/architecture.md §7).
 */
export async function withOptionalTransaction<T>(
  work: (session: ClientSession | undefined) => Promise<T>,
): Promise<T> {
  supportsTransactions ??= detectTransactionSupport().catch(() => false);
  if (!(await supportsTransactions)) return work(undefined);
  return mongoose.connection.transaction((session) => work(session));
}

/** Test hook: forget the cached capability (e.g. after reconnecting to another server). */
export function resetTransactionSupportCache(): void {
  supportsTransactions = undefined;
}
