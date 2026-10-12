import { describe, expect, it } from 'vitest';
import { meResponseSchema } from '@/types/api';
import { ApiError, apiRequest, onSessionExpired } from '@/lib/api-client';
import { getAccessToken, setAccessToken } from '@/lib/token-store';
import { errorBody, mockApi, noSession, sessionBody, testUser } from '@/test/mock-api';

const expired = { status: 401, body: errorBody('TOKEN_EXPIRED', 'Access token has expired') };

describe('apiRequest', () => {
  it('refreshes once on TOKEN_EXPIRED and retries with the new token', async () => {
    setAccessToken('stale-token');
    const { calls } = mockApi({
      'GET /auth/me': [expired, { status: 200, body: { user: testUser } }],
      'POST /auth/refresh': { status: 200, body: { ...sessionBody, accessToken: 'fresh-token' } },
    });

    const result = await apiRequest('/auth/me', meResponseSchema);

    expect(result.user.email).toBe(testUser.email);
    expect(getAccessToken()).toBe('fresh-token');
    const meCalls = calls.filter((call) => call.path === '/auth/me');
    expect(meCalls.map((call) => call.headers.authorization)).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
  });

  it('shares a single refresh between concurrent expired requests', async () => {
    setAccessToken('stale-token');
    const { calls } = mockApi({
      'GET /auth/me': [expired, expired, { status: 200, body: { user: testUser } }],
      'POST /auth/refresh': { status: 200, body: sessionBody },
    });

    await Promise.all([apiRequest('/auth/me', meResponseSchema), apiRequest('/auth/me', meResponseSchema)]);

    expect(calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(1);
  });

  it('signals session expiry and throws when the refresh fails', async () => {
    setAccessToken('stale-token');
    mockApi({ 'GET /auth/me': expired, 'POST /auth/refresh': noSession });
    let expiredSignals = 0;
    const unsubscribe = onSessionExpired(() => {
      expiredSignals += 1;
    });

    await expect(apiRequest('/auth/me', meResponseSchema)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(expiredSignals).toBe(1);
    expect(getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('turns network failures into a friendly ApiError', async () => {
    const { fetchMock } = mockApi({});
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error: unknown = await apiRequest('/auth/me', meResponseSchema, { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
  });
});
