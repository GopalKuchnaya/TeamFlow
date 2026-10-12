import { Router } from 'express';
import { isDatabaseReady } from '../../config/database.js';

export function createHealthRouter(): Router {
  const router = Router();

  /** Liveness: the process is up and serving HTTP. */
  router.get('/', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  /** Readiness: dependencies needed to serve traffic are available. */
  router.get('/ready', (_req, res) => {
    const database = isDatabaseReady();
    res.status(database ? 200 : 503).json({
      status: database ? 'ready' : 'unavailable',
      checks: { database: database ? 'up' : 'down' },
    });
  });

  return router;
}
