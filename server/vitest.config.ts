import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/helpers/global-setup.ts'],
    // Argon2 hashing and a real mongod make some tests slower than the default allows.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Replaced per test file with a dedicated database (see tests/helpers/database.ts).
      MONGODB_URI: 'mongodb://127.0.0.1:27017/teamflow-test-placeholder',
      JWT_ACCESS_SECRET: 'test-only-secret-that-is-at-least-32-characters-long',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
