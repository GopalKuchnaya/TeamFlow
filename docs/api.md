# TeamFlow — API Reference

Base URL: `/api/v1` (e.g. `http://localhost:4000/api/v1`). All bodies are JSON. This
document lists only **implemented** endpoints; later phases add to it.

## Conventions

### Authentication

- Protected endpoints require `Authorization: Bearer <accessToken>`.
- The refresh token is an `HttpOnly` cookie named `tf_refresh`, scoped to `Path=/api/v1/auth`.
  It is never present in a response body.
- Cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) require the header
  `X-Requested-With: teamflow` (CSRF defence).
- Browser clients must send requests with `credentials: 'include'` for the cookie to flow.

### Error envelope

Every error response has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "email", "message": "Enter a valid email address" }],
    "requestId": "8a7c…"
  }
}
```

`details` appears only when an error refers to specific fields. `requestId` matches the
`X-Request-Id` response header and the server log entry.

| Status | Code | Meaning |
| ------ | ---- | ------- |
| 400 | `VALIDATION_ERROR` | Body/query/params failed validation (see `details`) |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 401 | `UNAUTHENTICATED` | Missing or invalid access token |
| 401 | `TOKEN_EXPIRED` | Access token expired; call `POST /auth/refresh` and retry |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (deliberately indistinguishable) |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh cookie missing, expired, revoked, or reused |
| 403 | `CSRF_HEADER_MISSING` | `X-Requested-With: teamflow` header missing |
| 403 | `FORBIDDEN` | Authenticated but not permitted _(used from Phase 2)_ |
| 404 | `NOT_FOUND` | Unknown route or resource |
| 409 | `EMAIL_TAKEN` | Registration with an existing email |
| 409 | `CONFLICT` | Other unique-constraint violation |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds 100 KB |
| 429 | `RATE_LIMITED` | Too many requests; see `RateLimit` / `Retry-After` headers |
| 500 | `INTERNAL_ERROR` | Unexpected failure (details are logged, never returned) |

### User DTO

```json
{
  "id": "6650c3…",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "avatarUrl": null,
  "createdAt": "2026-10-12T15:00:00.000Z"
}
```

### Session response

Returned by register, login, and refresh (it also sets or rotates the `tf_refresh` cookie):

```json
{ "user": { "…": "User DTO" }, "accessToken": "eyJ…", "expiresIn": 900 }
```

---

## Health

### `GET /health`

Liveness. `200 { "status": "ok", "uptimeSeconds": 42 }`.

### `GET /health/ready`

Readiness. Returns `200 { "status": "ready", "checks": { "database": "up" } }`, or `503` with
`"status": "unavailable"` when MongoDB is not connected.

---

## Auth

### `POST /auth/register`

Rate limit: 20 / hour / IP.

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "correct-horse-1" }
```

- `name`: 1–80 characters, trimmed.
- `email`: valid email, ≤ 254 characters; trimmed and lower-cased.
- `password`: 8–128 characters, at least one letter and one number.

Responses: `201` session response · `400 VALIDATION_ERROR` · `409 EMAIL_TAKEN` (with
`details[0].path = "email"`) · `429`.

### `POST /auth/login`

Rate limits: 10 / 15 min per IP+email, and 100 / 15 min per IP.

```json
{ "email": "ada@example.com", "password": "correct-horse-1" }
```

Responses: `200` session response · `400` · `401 INVALID_CREDENTIALS` · `429`.

### `POST /auth/refresh`

Headers: `X-Requested-With: teamflow`; cookie `tf_refresh`. Rate limit: 60 / 15 min / IP.

Rotates the refresh token. A rotated token reused after the grace window revokes the whole
session family.

Responses: `200` session response (with a new cookie) · `401 INVALID_REFRESH_TOKEN` (the cookie
is cleared) · `403 CSRF_HEADER_MISSING`.

### `POST /auth/logout`

Headers: `X-Requested-With: teamflow`; cookie `tf_refresh` (optional).

Revokes the current session family and clears the cookie. Idempotent. Other devices stay
signed in.

Responses: `204` · `403 CSRF_HEADER_MISSING`.

### `GET /auth/me`

Headers: `Authorization: Bearer <accessToken>`.

Responses: `200 { "user": User DTO }` · `401 UNAUTHENTICATED | TOKEN_EXPIRED`.
