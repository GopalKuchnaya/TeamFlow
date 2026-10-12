import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

/** Gives each test file its own database and empties it after every test. */
export function useTestDatabase(): void {
  beforeAll(async () => {
    const baseUri = inject('mongoUri').replace(/\/$/, '');
    await mongoose.connect(`${baseUri}/teamflow-test-${randomUUID()}`);
    await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db?.collections();
    await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
