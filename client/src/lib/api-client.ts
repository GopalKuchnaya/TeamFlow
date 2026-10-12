import type { z } from 'zod';
import { apiErrorBodySchema, sessionResponseSchema, type FieldIssue, type SessionResponse } from '@/types/api';
import { getAccessToken, setAccessToken } from './token-store';

export const API_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');
const CSRF_HEADERS = { 'X-Requested-With': 'teamflow' } as const;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: FieldIssue[] = [],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Notified when the session can no longer be refreshed (e.g. it was revoked elsewhere). */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, body: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details, requestId } = parsed.data.error;
    return new ApiError(response.status, code, message, details, requestId);
  }
  return new ApiError(response.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
}

async function send(path: string, init: RequestInit): Promise<{ response: Response; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  }
  return { response, body: await readBody(response) };
}

let refreshInFlight: Promise<SessionResponse | null> | null = null;

/**
 * Exchanges the HttpOnly refresh cookie for a new access token. Concurrent callers share a
 * single request so a burst of expired requests causes only one rotation.
 * Resolves to `null` when there is no valid session.
 */
export function refreshSession(): Promise<SessionResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const { response, body } = await send('/auth/refresh', { method: 'POST', headers: CSRF_HEADERS });
      if (response.status === 401) {
        setAccessToken(null);
        return null;
      }
      if (!response.ok) throw toApiError(response, body);
      const session = sessionResponseSchema.parse(body);
      setAccessToken(session.accessToken);
      return session;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the bearer token and transparently refresh it once if it has expired. Default true. */
  auth?: boolean;
  /** Include the anti-CSRF header (required by cookie-authenticated auth endpoints). */
  csrf?: boolean;
}

async function execute(path: string, options: RequestOptions): Promise<unknown> {
  const { method = 'GET', body, auth = true, csrf = false } = options;

  const buildInit = (): RequestInit => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf) Object.assign(headers, CSRF_HEADERS);
    const token = getAccessToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };
  };

  let { response, body: responseBody } = await send(path, buildInit());

  if (auth && response.status === 401) {
    const error = toApiError(response, responseBody);
    const canRefresh = error.code === 'TOKEN_EXPIRED' || (error.code === 'UNAUTHENTICATED' && !getAccessToken());
    const session = canRefresh ? await refreshSession() : null;
    if (!session) {
      setAccessToken(null);
      sessionExpiredListeners.forEach((listener) => { listener(); });
      throw error;
    }
    ({ response, body: responseBody } = await send(path, buildInit()));
  }

  if (!response.ok) throw toApiError(response, responseBody);
  return responseBody;
}

/** Performs a request and validates the JSON response against `schema`. */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  return schema.parse(await execute(path, options));
}

/** Performs a request whose response has no body (e.g. 204 No Content). */
export async function apiRequestNoContent(path: string, options: RequestOptions = {}): Promise<void> {
  await execute(path, options);
}
