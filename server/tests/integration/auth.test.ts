import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { SessionModel } from '../../src/modules/auth/session.model.js';
import { UserModel } from '../../src/modules/users/user.model.js';
import { hashToken } from '../../src/utils/crypto.js';
import { CSRF, cookiePair, getRefreshCookie, registerUser, validUser } from '../helpers/auth.js';
import { useTestDatabase } from '../helpers/database.js';

useTestDatabase();

let app: Express;
beforeEach(() => {
  app = createApp();
});

interface ErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[]; requestId: string };
}

describe('POST /api/v1/auth/register', () => {
  it('creates a user, returns an access token, and sets an HttpOnly refresh cookie', async () => {
    const { res, user } = await registerUser(app);

    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        name: validUser.name,
        email: validUser.email,
        avatarUrl: null,
        createdAt: expect.any(String),
      },
      accessToken: expect.any(String),
      expiresIn: 900,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const cookie = getRefreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/);
    // The refresh token must never appear in the response body.
    expect(JSON.stringify(res.body)).not.toContain(cookiePair(cookie).split('=')[1]);

    expect(await UserModel.countDocuments({ _id: user.id })).toBe(1);
  });

  it('stores an Argon2id hash, never the plaintext password', async () => {
    await registerUser(app);
    const stored = await UserModel.findOne({ email: validUser.email }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain(validUser.password);
  });

  it('stores only a hash of the refresh token', async () => {
    const { cookie } = await registerUser(app);
    const raw = cookie.split('=')[1] ?? '';
    expect(await SessionModel.countDocuments({ tokenHash: raw })).toBe(0);
    expect(await SessionModel.countDocuments({ tokenHash: hashToken(raw) })).toBe(1);
  });

  it('normalises email and rejects duplicates case-insensitively with 409', async () => {
    await registerUser(app, { email: '  Ada@Example.COM ' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, email: 'ada@example.com' })
      .expect(409);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('EMAIL_TAKEN');
    expect(body.error.details).toEqual([{ path: 'email', message: expect.any(String) }]);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('handles concurrent duplicate registrations safely', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => request(app).post('/api/v1/auth/register').send(validUser)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it.each([
    [{ ...validUser, email: 'not-an-email' }, 'email'],
    [{ ...validUser, password: 'short1' }, 'password'],
    [{ ...validUser, password: 'lettersonly' }, 'password'],
    [{ ...validUser, password: '12345678' }, 'password'],
    [{ ...validUser, name: '   ' }, 'name'],
    [{ email: validUser.email, password: validUser.password }, 'name'],
  ])('rejects invalid input %# with field details', async (payload, field) => {
    const res = await request(app).post('/api/v1/auth/register').send(payload).expect(400);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.map((d) => d.path)).toContain(field);
  });

  it('ignores unexpected fields such as a client-supplied passwordHash', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, passwordHash: 'attacker-controlled' })
      .expect(201);
    const stored = await UserModel.findOne({ email: validUser.email }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects NoSQL operator injection in fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, email: { $gt: '' } })
      .expect(400);
    expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await registerUser(app);
  });

  it('logs in with valid credentials (email is case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ADA@example.com', password: validUser.password })
      .expect(200);
    expect(res.body).toMatchObject({ user: { email: validUser.email }, accessToken: expect.any(String) });
    expect(getRefreshCookie(res)).toMatch(/HttpOnly/);
  });

  it('returns the same safe error for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrong-password-1' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-1' })
      .expect(401);

    for (const res of [wrongPassword, unknownEmail]) {
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toBe('Invalid email or password');
      expect(getRefreshCookie(res)).toBeUndefined();
    }
  });

  it('rejects a login payload with operator injection', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: { $ne: '' } })
      .expect(400);
  });

  it('rate-limits repeated attempts against one account', async () => {
    const attempt = () =>
      request(app).post('/api/v1/auth/login').send({ email: validUser.email, password: 'wrong-password-1' });
    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect((limited.body as ErrorBody).error.code).toBe('RATE_LIMITED');

    // Even the correct password is refused while the limit is active.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(429);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const { accessToken, user } = await registerUser(app);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(res.body).toEqual({ user: expect.objectContaining({ id: user.id, email: validUser.email }) });
  });

  it.each([
    ['no header', undefined],
    ['malformed header', 'Token abc'],
    ['garbage token', 'Bearer not.a.jwt'],
  ])('rejects requests with %s', async (_label, header) => {
    const req = request(app).get('/api/v1/auth/me');
    if (header) void req.set('Authorization', header);
    const res = await req.expect(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('does not accept the refresh cookie as authentication', async () => {
    const { cookie } = await registerUser(app);
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  });

  it('rejects a valid token once the user no longer exists', async () => {
    const { accessToken, user } = await registerUser(app);
    await UserModel.deleteOne({ _id: user.id });
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
  });

  it('reports an expired access token with TOKEN_EXPIRED', async () => {
    const { accessToken } = await registerUser(app);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 901 * 1000);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      expect((res.body as ErrorBody).error.code).toBe('TOKEN_EXPIRED');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh token and returns a fresh access token and user (session restore on reload)', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie).expect(200);
    expect(res.body).toMatchObject({ user: { email: validUser.email }, accessToken: expect.any(String) });

    const rotated = cookiePair(getRefreshCookie(res));
    expect(rotated).not.toBe(cookie);

    const accessToken = (res.body as { accessToken: string }).accessToken;
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
  });

  it('requires the anti-CSRF header', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(403);
    expect((res.body as ErrorBody).error.code).toBe('CSRF_HEADER_MISSING');
  });

  it('rejects a missing or unknown refresh token and clears the cookie', async () => {
    await request(app).post('/api/v1/auth/refresh').set(CSRF).expect(401);
    const res = await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', 'tf_refresh=forged').expect(401);
    expect((res.body as ErrorBody).error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(getRefreshCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('allows a just-rotated token within the grace window (parallel tabs)', async () => {
    const { cookie } = await registerUser(app);
    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie).expect(200);
    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie).expect(200);
  });

  it('detects reuse of a rotated token after the grace window and revokes the whole family', async () => {
    const { cookie: original } = await registerUser(app);
    const first = await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', original).expect(200);
    const current = cookiePair(getRefreshCookie(first));

    // Simulate the grace window elapsing for the rotated token.
    await SessionModel.updateOne(
      { tokenHash: hashToken(original.split('=')[1] ?? '') },
      { $set: { revokedAt: new Date(Date.now() - 60_000) } },
    );

    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', original).expect(401);
    // The legitimate (latest) token is now revoked too.
    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', current).expect(401);
    expect(await SessionModel.countDocuments({ revokedReason: 'reuse_detected' })).toBe(1);
  });

  it('rejects an expired refresh token', async () => {
    const { cookie } = await registerUser(app);
    await SessionModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie).expect(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session family and clears the cookie', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app).post('/api/v1/auth/logout').set(CSRF).set('Cookie', cookie).expect(204);
    expect(getRefreshCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie).expect(401);
    expect(await SessionModel.countDocuments({ revokedReason: 'logout' })).toBe(1);
  });

  it('does not affect other sessions of the same user', async () => {
    const { cookie: first } = await registerUser(app);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);
    const second = cookiePair(getRefreshCookie(login));

    await request(app).post('/api/v1/auth/logout').set(CSRF).set('Cookie', first).expect(204);
    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', second).expect(200);
  });

  it('is idempotent without a session', async () => {
    await request(app).post('/api/v1/auth/logout').set(CSRF).expect(204);
  });

  it('requires the anti-CSRF header', async () => {
    const { cookie } = await registerUser(app);
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(403);
    await request(app).post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie).expect(200);
  });
});
