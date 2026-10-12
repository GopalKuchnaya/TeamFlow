import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { getEnv } from './config/env.js';
import { getLogger } from './config/logger.js';

async function main(): Promise<void> {
  const env = getEnv();
  const logger = getLogger();

  await connectDatabase(env.MONGODB_URI);

  const server = createServer(createApp());
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'TeamFlow API listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close((closeError) => {
      disconnectDatabase()
        .then(() => process.exit(closeError ? 1 : 0))
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Error while disconnecting from MongoDB');
          process.exit(1);
        });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
}

main().catch((error: unknown) => {
  // The logger may not exist if configuration itself is invalid.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
