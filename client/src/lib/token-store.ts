/**
 * The access token lives only in memory. It is never written to localStorage or
 * sessionStorage, so an XSS payload cannot harvest a persistent credential; on reload the
 * HttpOnly refresh cookie restores the session.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
