import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { useTestDatabase } from '../helpers/database.js';

useTestDatabase();

const app = createApp();

describe('application middleware', () => {
  it('serves liveness and readiness health checks', async () => {
    const live = await request(app).get('/api/v1/health').expect(200);
    expect(live.body).toMatchObject({ status: 'ok' });
    const ready = await request(app).get('/api/v1/health/ready').expect(200);
    expect(ready.body).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('returns a consistent JSON envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), requestId: expect.any(String) },
    });
    expect(res.headers['x-request-id']).toBe((res.body as { error: { requestId: string } }).error.requestId);
  });

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_JSON');
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'x'.repeat(200 * 1024), email: 'a@b.co', password: 'abcdefg1' })
      .expect(413);
    expect((res.body as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('allows credentialed CORS only for configured origins', async () => {
    const allowed = await request(app)
      .options('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'x-requested-with');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app)
      .options('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('propagates a safe client-supplied request id and replaces unsafe ones', async () => {
    const safe = await request(app).get('/api/v1/health').set('X-Request-Id', 'abc-123');
    expect(safe.headers['x-request-id']).toBe('abc-123');
    const unsafe = await request(app).get('/api/v1/health').set('X-Request-Id', '<script>');
    expect(unsafe.headers['x-request-id']).not.toBe('<script>');
  });
});
