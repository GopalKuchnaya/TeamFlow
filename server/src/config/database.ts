import mongoose from 'mongoose';
import { getLogger } from './logger.js';

// Unknown filter fields are dropped. Operator injection is prevented upstream: every request
// is parsed by a Zod schema that only admits primitives where queries expect them.
mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  const logger = getLogger();
  mongoose.connection.on('disconnected', () => { logger.warn('MongoDB disconnected'); });
  mongoose.connection.on('reconnected', () => { logger.info('MongoDB reconnected'); });
  mongoose.connection.on('error', (error: unknown) => { logger.error({ err: error }, 'MongoDB error'); });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Ensure declared indexes (unique email, TTL sessions, ...) exist before serving traffic.
  // createIndexes never drops indexes, unlike syncIndexes.
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
