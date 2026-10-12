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
| 403 | `FORBIDDEN` | Member of the workspace, but the role lacks the permission |
| 403 | `INVITATION_EMAIL_MISMATCH` | Invitation addressed to another email |
| 404 | `NOT_FOUND` | Unknown route or resource |
| 404 | `INVITATION_NOT_FOUND` | Unknown or revoked invitation token |
| 409 | `EMAIL_TAKEN` | Registration with an existing email |
| 409 | `ALREADY_MEMBER` | Inviting, or accepting as, someone already in the workspace |
| 409 | `INVITATION_ALREADY_USED` | Invitation already accepted |
| 410 | `INVITATION_EXPIRED` | Invitation past `expiresAt` |
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

---

## Pagination

List endpoints accept `?page=1&limit=20` (`page` 1–10 000, `limit` 1–100) and return:

```json
{ "items": [], "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
```

Out-of-range or non-numeric values return `400 VALIDATION_ERROR`.

## Workspace access rules

All workspace endpoints require `Authorization: Bearer`. The server checks the caller's
membership on every request:

- **Not a member, or the workspace does not exist → `404 NOT_FOUND`.** The two cases are
  indistinguishable on purpose.
- **Member without the required role → `403 FORBIDDEN`.**
- Malformed ids (not 24-char hex) → `400 VALIDATION_ERROR`.

See the permission matrix in `architecture.md` §6.

### Workspace DTO

```json
{
  "id": "6650…",
  "name": "Rocket Team",
  "slug": "rocket-team-a1b2c3",
  "description": "Launch planning",
  "ownerId": "6650…",
  "role": "owner",
  "createdAt": "…",
  "updatedAt": "…"
}
```

`role` is the **caller's** role in the workspace.

---

## Workspaces

| Method & path | Who | Body | Success |
| ------------- | --- | ---- | ------- |
| `GET /workspaces` | any user | — (pagination query) | `200` page of Workspace DTOs, most recently joined first |
| `POST /workspaces` | any user | `{ name (1–80), description? (≤500) }` | `201 { workspace }`; the caller becomes owner |
| `GET /workspaces/:workspaceId` | member | — | `200 { workspace }` |
| `PATCH /workspaces/:workspaceId` | owner | `{ name?, description? }` (at least one) | `200 { workspace }` |
| `DELETE /workspaces/:workspaceId` | owner | — | `204`; memberships and invitations are deleted |
| `POST /workspaces/:workspaceId/transfer-ownership` | owner | `{ userId }` (an existing member) | `200 { workspace }`; the caller becomes admin |

Unknown body fields (e.g. `ownerId`, `slug`) are ignored.

## Members

| Method & path | Who | Body / query | Success |
| ------------- | --- | ------------ | ------- |
| `GET /workspaces/:workspaceId/members` | member | `?page&limit&role=owner\|admin\|member` | `200` page of Member DTOs, by join date |
| `PATCH /workspaces/:workspaceId/members/:userId` | owner | `{ role: "admin" \| "member" }` | `200 { member }` |
| `DELETE /workspaces/:workspaceId/members/:userId` | see below | — | `204` |

Member DTO: `{ userId, name, email, avatarUrl, role, joinedAt }`.

Role changes never touch the owner (`403`), and `"owner"` is not an accepted value (`400`);
use ownership transfer instead. Removal rules: the owner may remove anyone except
themselves, and admins may remove members only. Anyone except the owner may remove
**themselves**, which is how a user leaves. A `:userId` that is not a member returns `404`.

## Invitations

| Method & path | Who | Body / query | Success |
| ------------- | --- | ------------ | ------- |
| `POST /workspaces/:workspaceId/invitations` | owner, admin | `{ email, role?: "member" \| "admin" }` (default `member`) | `201 { invitation, token }` |
| `GET /workspaces/:workspaceId/invitations` | owner, admin | pagination query | `200` page of pending invitations, newest first |
| `DELETE /workspaces/:workspaceId/invitations/:invitationId` | owner, admin | — | `204` |
| `POST /invitations/preview` | **public** | `{ token }` | `200 { invitation: InvitationPreview }` |
| `POST /invitations/accept` | any user | `{ token }` | `200 { workspace }` with the invited role |

- Admins may invite with role `member` only (`403` for `admin`). Inviting an existing member
  returns `409 ALREADY_MEMBER`. Re-inviting an email revokes its previous pending link.
- `token` is a 256-bit random value, returned **once** at creation (only its SHA-256 is
  stored). The client builds the link `/invite/<token>`. Tokens are always sent in request
  **bodies**, never API URLs, so they stay out of server access logs.
- Invitations expire after 7 days and can be accepted once.
- Invitation DTO: `{ id, email, role, invitedBy: { id, name } | null, expiresAt, createdAt }`.
- InvitationPreview: `{ workspaceName, email, role, invitedByName, expiresAt, status: "pending" | "accepted" | "expired" }`.
- Accept errors: `404 INVITATION_NOT_FOUND` (unknown, revoked, or workspace deleted) ·
  `409 INVITATION_ALREADY_USED` · `410 INVITATION_EXPIRED` ·
  `403 INVITATION_EMAIL_MISMATCH` · `409 ALREADY_MEMBER`.
- Rate limits: preview and accept, 30 / 15 min per IP; creating invitations, 50 / hour per
  user.
