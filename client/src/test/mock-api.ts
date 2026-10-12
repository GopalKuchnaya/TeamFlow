import { vi } from 'vitest';

export interface MockResponse {
  status: number;
  body?: unknown;
}

export interface RecordedCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (call: RecordedCall) => MockResponse;

/**
 * Stubs `fetch` with handlers keyed by "METHOD /path" (path relative to /api/v1).
 * Array values are consumed in order, which models sequences such as expire-then-succeed.
 */
export function mockApi(routes: Record<string, Handler | MockResponse | MockResponse[]>) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const call: RecordedCall = { method, path, headers, body };
    calls.push(call);

    const route = routes[`${method} ${path}`];
    let result: MockResponse | undefined;
    if (typeof route === 'function') result = route(call);
    else if (Array.isArray(route)) result = route.length > 1 ? route.shift() : route[0];
    else result = route;
    if (!result) throw new Error(`Unhandled request: ${method} ${path}`);

    return Promise.resolve(
      new Response(result.body === undefined ? null : JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const testUser = {
  id: '65f000000000000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  avatarUrl: null,
  createdAt: '2026-01-15T10:00:00.000Z',
};

export const sessionBody = { user: testUser, accessToken: 'access-token-1', expiresIn: 900 };

export function errorBody(code: string, message: string, details?: { path: string; message: string }[]) {
  return { error: { code, message, requestId: 'req-1', ...(details ? { details } : {}) } };
}

export const noSession: MockResponse = {
  status: 401,
  body: errorBody('INVALID_REFRESH_TOKEN', 'Session is invalid or has expired'),
};
