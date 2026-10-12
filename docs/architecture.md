# TeamFlow — Architecture

This document records the architecture of TeamFlow, the decisions behind it, and the
authorization model every phase must respect. It is updated as phases land; sections
marked _(planned)_ describe design that is agreed but not yet implemented.

## 1. Repository audit (Phase 0)

At the start of the project the repository contained no commits and no files, so there were
no existing conventions, lockfiles, or code to preserve. Consequences:

- The package manager is **npm** (bundled with Node 22) using **npm workspaces**; a single
  root `package-lock.json` pins both apps.
- The structure below was created from scratch, following the suggested layout in the
  project specification.

Environment constraints discovered during the audit (they affect testing, not the product):

- No MongoDB server was installed, and the sandbox cannot reach `fastdl.mongodb.org`, where
  `mongodb-memory-server` normally downloads `mongod`. The `mongod` binary was extracted from
  the official `mongo:7` Docker image and supplied through the `MONGOMS_SYSTEM_BINARY` environment
  variable. On a normal developer machine no variable is needed: `mongodb-memory-server`
  downloads a binary automatically.

## 2. High-level design

```
┌────────────────────────┐   HTTPS (JSON, /api/v1)   ┌─────────────────────────┐
│  client (React SPA)    │ ────────────────────────▶ │  server (Express API)   │
│  Vite · Chakra UI v3   │   Authorization: Bearer   │  Zod · Mongoose · JWT   │
│  TanStack Query        │   + refresh cookie on     │  pino logging           │
│  React Router          │     /api/v1/auth only     │                         │
│                        │ ◀──── Socket.io (Phase 4) │  Socket.io (Phase 4)    │
└────────────────────────┘                           └───────────┬─────────────┘
                                                                 │ Mongoose
                                                         ┌───────▼───────┐
                                                         │   MongoDB     │
                                                         └───────────────┘
```

- **Modular monolith.** There is one Express API process organised by domain modules. No
  microservices are planned: the domain is small and transactional consistency is simpler
  inside one process.
- **REST is authoritative.** All persistence goes through the REST API. Socket.io (Phase 4)
  only broadcasts changes that already succeeded, and clients reconcile them into the
  TanStack Query cache.
- **SPA + API on separate origins in production.** In development, the Vite dev server
  proxies `/api` to the API, so the browser treats them as the same origin.

## 3. Directory structure

```
teamflow/
├── client/                      React SPA
│   └── src/
│       ├── app/                 providers, router, query client
│       ├── components/          shared UI (layout, feedback states)
│       ├── features/<domain>/   api hooks, pages, schemas per domain
│       ├── lib/                 api client, token store, helpers
│       ├── routes/              route guards
│       ├── theme/               Chakra design tokens
│       ├── types/               shared client types (API DTOs)
│       └── test/                test setup and utilities
├── server/
│   ├── src/
│   │   ├── config/              env parsing (Zod), logger, database connection
│   │   ├── middleware/          auth, validation, errors, rate limits, request id
│   │   ├── modules/<domain>/    routes · controller · service · model · schemas · policy · dto
│   │   ├── utils/               AppError, crypto helpers, async helpers
│   │   ├── sockets/             (Phase 4)
│   │   ├── app.ts               builds the Express app (no listen; used by tests)
│   │   └── server.ts            process entry: env, DB connect, listen, graceful shutdown
│   └── tests/                   integration tests (Supertest + mongodb-memory-server)
├── docs/                        architecture, API, schema, roadmap
└── package.json                 npm workspaces + orchestration scripts
```

Each backend module separates concerns as follows:

| File               | Responsibility                                                         |
| ------------------ | ---------------------------------------------------------------------- |
| `*.routes.ts`      | URL → middleware chain (auth, validation, rate limit) → controller     |
| `*.controller.ts`  | HTTP translation only: read validated input, call service, send DTO    |
| `*.service.ts`     | Business rules, DB access, and calls to authorization policies         |
| `*.model.ts`       | Mongoose schema, indexes, TS document types                            |
| `*.schemas.ts`     | Zod schemas for request body/query/params                              |
| `*.policy.ts`      | Pure authorization decisions (role → allowed actions) _(Phase 2+)_     |
| `*.dto.ts`         | Explicit mapping from documents to response objects (no leaked fields) |

Dependencies flow `routes → controller → service → model/policy`. Services never import
controllers or routes, which keeps the graph acyclic.

## 4. Key architectural decisions

| #  | Decision | Reasoning |
| -- | -------- | --------- |
| D1 | npm workspaces monorepo (`client`, `server`) | Empty repo, so npm is the default. One install and one lockfile; each app keeps its own `tsconfig` and tooling. |
| D2 | TypeScript 5.9 (strict) in both apps | Current stable line supported by `typescript-eslint` (TS 7 is not yet supported by the lint toolchain). |
| D3 | Express 5 | Native async error propagation (no `express-async-errors` wrapper); maintained major version. |
| D4 | Mongoose 9 on MongoDB 7+ | Schema validation, indexes declared beside models, and typed models. |
| D5 | Zod 4 for request validation and env parsing | One validation library for runtime input and configuration; the app fails fast on bad config. |
| D6 | Argon2id (`argon2` package) for password hashing | OWASP-recommended memory-hard KDF. Parameters: 19 MiB memory, t=2, p=1 (OWASP minimum profile). |
| D7 | Access JWT in memory + rotating refresh token in an HttpOnly cookie | See §5. No long-lived token is readable by JavaScript or stored in localStorage. |
| D8 | pino + pino-http structured logging with redaction | Fast JSON logs; `authorization`, `cookie`, `set-cookie`, and password fields are redacted. A request id is attached to every log line and returned in `X-Request-Id`. |
| D9 | Consistent error envelope `{ error: { code, message, details?, requestId } }` | The client can branch on stable `code` values; details are present only for validation errors; 500s never expose internals. |
| D10 | Chakra UI v3 with a custom system (tokens) | Required by the spec. Brand tokens live in `client/src/theme`. |
| D11 | TanStack Query owns all server state, including the session | There is no separate global auth store. The session is the `['auth','session']` query, and logout clears the cache. |
| D12 | Client form schemas mirror server constraints (they are not shared through a package) | Avoids a third build target in Phase 1. The server stays authoritative and the client schemas are a UX convenience. This can be revisited if duplication grows. |
| D13 | Tests run against a real `mongod` (mongodb-memory-server), not mocks | Unique indexes, TTL indexes, and query semantics are part of the behaviour under test. |
| D14 | Per-app `.env.example` (`server/.env.example`, `client/.env.example`) | Each process loads its own env; frontend variables are public by definition (`VITE_*`) and must never hold secrets. |

## 5. Authentication design (implemented in Phase 1)

### Token strategy

| Token | Format | Lifetime | Where it lives | Sent how |
| ----- | ------ | -------- | -------------- | -------- |
| Access token | JWT, HS256, claims `sub`, `iss`, `aud`, `iat`, `exp` | 15 min (`ACCESS_TOKEN_TTL`) | JS memory only (module variable) | `Authorization: Bearer …` |
| Refresh token | 256-bit random value, base64url | 7 days (`REFRESH_TOKEN_TTL_DAYS`) | `HttpOnly` cookie `tf_refresh`, `Path=/api/v1/auth`, `Secure` in production, `SameSite` configurable (default `Lax`) | Browser sends it automatically, only to `/api/v1/auth/*` |

- **Only the SHA-256 hash** of a refresh token is stored in the `sessions` collection.
- **Rotation:** each successful `POST /auth/refresh` revokes the presented token and issues a
  new one in the same *family*.
- **Reuse detection:** if a token that was already rotated is presented again after a short
  grace window (`REFRESH_REUSE_GRACE_SECONDS`, default 10 s), the whole family is revoked, so
  a stolen token cannot coexist with the legitimate one. The grace window prevents false
  positives when two browser tabs refresh at the same moment.
- **Logout** revokes the current family and clears the cookie.
- **Reload:** on start-up the SPA calls `POST /auth/refresh`. A valid cookie returns a new
  access token and the user, so the session survives reloads without exposing a token to
  storage.
- **CSRF:** API routes authenticate with the `Authorization` header, which browsers never
  attach automatically, so they are not CSRF-able. The two cookie-authenticated endpoints
  (`/auth/refresh`, `/auth/logout`) require the custom header `X-Requested-With: teamflow`.
  A cross-origin page cannot send that header without passing a CORS preflight, and the
  preflight only succeeds for allowlisted origins.
- **Deleted users:** the auth middleware loads the user on every request (indexed `_id`
  lookup), so a deleted account loses access immediately and not when its token expires.
- **Socket.io (Phase 4)** will authenticate with the same access token in the handshake
  `auth` payload.

### Brute-force and abuse controls

- `POST /auth/login`: at most 10 attempts per 15 minutes per IP+email pair, plus 100 per
  15 minutes per IP. Returns `429` with code `RATE_LIMITED`.
- `POST /auth/register`: 20 per hour per IP. `POST /auth/refresh`: 60 per 15 minutes per IP.
- Unknown email and wrong password return the same `401 INVALID_CREDENTIALS` response, and a
  dummy Argon2 verification runs for unknown emails, so response timing does not reveal
  which emails are registered.
- Duplicate registration returns `409 EMAIL_TAKEN`. This does reveal that an email is
  registered, a trade-off accepted for usability; registration rate limiting bounds
  enumeration.

### Transport and request hardening

- `helmet` security headers; `x-powered-by` disabled.
- CORS allowlist from `CORS_ORIGINS` (comma-separated), `credentials: true`.
- JSON body limit `100kb`; `trust proxy` is configurable for deployment behind a load balancer
  (required for correct rate-limit IPs).
- Secrets are only read on the server through the validated env module and never logged.
- **NoSQL injection:** every request body is parsed by a Zod schema that only admits
  primitives where queries expect them (e.g. `email` must be a string, so `{ "$gt": "" }` is
  rejected with `400`). Mongoose `strictQuery` drops unknown filter fields. Mongoose's global
  `sanitizeFilter` is deliberately **not** enabled, because it also neutralises the server's
  own operator queries (`$gt` on `expiresAt`).

## 6. Workspace roles and permission matrix _(enforced from Phase 2)_

Every workspace-scoped request resolves the caller's `WorkspaceMembership` on the server.
A client-supplied `workspaceId` is only a lookup key, never proof of access. For resources
addressed by their own id (`/projects/:id`, `/tasks/:id`), the server loads the resource,
reads **its** `workspaceId`, and checks the caller's membership in that workspace. Callers
who are not members get `404` (not `403`), so the existence of resources in other
workspaces is not revealed. Members who lack a permission get `403 FORBIDDEN`.

| Action | Owner | Admin | Member |
| ------ | :---: | :---: | :----: |
| View workspace, members, projects, tasks | ✅ | ✅ | ✅ |
| Update workspace settings (name, description) | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| Invite members (role `member` or `admin`) | ✅ | ✅ (`member` only) | ❌ |
| Revoke pending invitations | ✅ | ✅ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |
| Remove members | ✅ (anyone but self) | ✅ (members only) | ❌ |
| Leave workspace | ❌ (must transfer first) | ✅ | ✅ |
| Create / update / archive / delete projects | ✅ | ✅ | ❌ |
| Create tasks, update any task field, move tasks | ✅ | ✅ | ✅ |
| Delete tasks | ✅ | ✅ | Own reported tasks only |
| Comment on tasks | ✅ | ✅ | ✅ |
| Edit / delete a comment | Own only (owner/admin may delete any) | Own only (may delete any) | Own only |
| View dashboard & activity | ✅ | ✅ | ✅ |
| Read / mark notifications | Own only | Own only | Own only |

Invariants:

- A workspace always has exactly one `owner` membership; the owner cannot be removed or demoted
  without an ownership transfer.
- Admins cannot elevate anyone to admin or owner, and cannot act on owner/admin members.
- Task assignees must be members of the task's workspace; a task's `projectId` must belong to
  the same workspace.

## 7. Consistency of multi-document operations

Transactions require a replica set or sharded cluster, and the project must not assume that
topology. The approach is:

1. **Order writes so that failure leaves a safe state.** Example: workspace creation inserts
   the workspace, then the owner membership. If the membership insert fails, the workspace is
   deleted as compensation. An orphaned workspace with no members is invisible, because all
   reads go through memberships.
2. **Rely on unique indexes for invariants**, not on read-then-write checks (email uniqueness,
   membership uniqueness, slug uniqueness, invitation acceptance via a conditional
   `findOneAndUpdate({ acceptedAt: null })`).
3. **Derived records are best-effort.** Notifications and activity logs are written after the
   primary write succeeds. A failure is logged but does not roll back the user's action.
4. **Transactions are optional.** Where an operation truly needs atomicity across collections
   (e.g. ownership transfer, workspace cascade delete), a `withOptionalTransaction` helper uses
   a session when the server supports transactions and otherwise falls back to the
   ordered/compensating approach. This will be implemented in Phase 2 when first needed.

## 8. Error handling and logging

- `AppError(status, code, message, details?)` is thrown from services. The central error
  middleware maps `AppError`, Zod errors, Mongo duplicate-key errors (`11000`), malformed JSON,
  and payload-too-large errors to the standard envelope. Anything else becomes
  `500 INTERNAL_ERROR` with a generic message and is logged with its stack.
- Unknown routes return `404 NOT_FOUND` in the same envelope.
- Logs are JSON in production and pretty-printed in development. Log level comes from
  `LOG_LEVEL`. Tests run at `silent`.

## 9. Frontend architecture

- **Routing:** `createBrowserRouter` (React Router 7). The route guards `RequireAuth` and
  `GuestOnly` are UX only; the API enforces everything independently.
- **Server state:** TanStack Query. The API client (`lib/api-client.ts`) attaches the in-memory
  access token. On `401 TOKEN_EXPIRED` it performs a single-flight refresh and retries the
  request once. If the refresh fails, it clears the session query, and the guard redirects
  to `/login`.
- **Forms:** React Hook Form + Zod resolver; server validation errors are mapped back onto
  fields when the server returns field details.
- **UI:** Chakra UI v3 with brand tokens (navy text, restrained indigo/violet accent), a light
  theme by default, a desktop sidebar, a mobile drawer navigation, and visible focus rings.
- **States:** every page uses shared `LoadingState`, `ErrorState`, and `EmptyState`
  components; a router `errorElement` catches render errors; a dedicated 404 page handles
  unknown routes.

## 10. Risks and assumptions

| Risk / assumption | Mitigation |
| ----------------- | ---------- |
| Production SPA and API on different *sites* need `SameSite=None; Secure` refresh cookies, which third-party-cookie restrictions can block | Prefer hosting both under one site (e.g. `app.example.com` + `api.example.com`) so `SameSite=Lax` works; the cookie attributes are configurable via env. Revisit in Phase 8. |
| MongoDB deployment may not support transactions | §7 strategy; transactions are used only opportunistically. |
| In-memory rate limiting is per process | Acceptable for a single instance. A shared store (Redis) is needed for horizontal scaling and is documented for Phase 8. |
| Kanban ordering under concurrent edits | Phase 3 uses sparse numeric `position` values with server-side rebalancing. The REST response is authoritative and the client reconciles. |
| Socket.io horizontal scaling | Single instance initially; the Redis adapter is a documented follow-up. |
| Access token lives in memory, so it is lost on reload | By design: the refresh cookie restores the session on reload. |
| Multi-tab refresh races | Handled with the reuse grace window (§5) and client single-flight. |
| Client bundle is ~910 kB minified (~267 kB gzip), mostly Chakra UI | Route-level code splitting and vendor chunking are planned for Phase 7/8. |
