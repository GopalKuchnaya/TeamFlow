import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';

/**
 * Serves the built React app from the API process, so the SPA and API share one origin and
 * the refresh cookie needs no cross-site configuration. Unknown non-API GET routes return
 * index.html for client-side routing; /api paths still fall through to the JSON 404.
 */
export function serveClient(app: Express, distDir: string): void {
  const root = path.resolve(distDir);
  const indexHtml = path.join(root, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(`CLIENT_DIST_DIR has no index.html: ${root}. Build the client first.`);
  }

  app.use(
    express.static(root, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints everything in /assets, so those files can be cached forever.
        const immutable = filePath.startsWith(path.join(root, 'assets'));
        res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );

  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}
