import type { Express } from 'express';
import request from 'supertest';

export const CSRF = { 'X-Requested-With': 'teamflow' } as const;

export const validUser = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-1',
};

/** Extracts the `tf_refresh` Set-Cookie header (raw string) from a response. */
export function getRefreshCookie(res: request.Response): string | undefined {
  const header = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((cookie) => cookie.startsWith('tf_refresh='));
}

/** Returns `tf_refresh=<value>` suitable for a Cookie request header. */
export function cookiePair(setCookie: string | undefined): string {
  if (!setCookie) throw new Error('Expected a refresh cookie');
  const pair = setCookie.split(';')[0];
  if (!pair) throw new Error('Malformed cookie');
  return pair;
}

export async function registerUser(app: Express, overrides: Partial<typeof validUser> = {}) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ ...validUser, ...overrides })
    .expect(201);
  const body = res.body as { accessToken: string; user: { id: string; email: string } };
  return { res, accessToken: body.accessToken, user: body.user, cookie: cookiePair(getRefreshCookie(res)) };
}
