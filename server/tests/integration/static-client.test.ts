import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler, notFoundHandler } from '../../src/middleware/error-handler.js';
import { serveClient } from '../../src/static-client.js';

function buildApp() {
  const dist = mkdtempSync(path.join(tmpdir(), 'teamflow-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
  const app = express();
  serveClient(app, dist);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('serving the built client', () => {
  const app = buildApp();

  it('serves fingerprinted assets with long-lived caching', async () => {
    const res = await request(app).get('/assets/index-abc123.js').expect(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('returns index.html for client-side routes, uncached', async () => {
    for (const route of ['/', '/w/abc/members', '/invite/some-token']) {
      const res = await request(app).get(route).expect(200);
      expect(res.text).toContain('<div id="root">');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('keeps JSON 404s for unknown API routes and non-GET requests', async () => {
    const api = await request(app).get('/api/v1/nope').expect(404);
    expect(api.headers['content-type']).toContain('application/json');
    await request(app).post('/somewhere').expect(404);
  });

  it('fails fast when the build is missing', () => {
    expect(() => { serveClient(express(), path.join(tmpdir(), 'does-not-exist')); }).toThrow(/index.html/);
  });
});
