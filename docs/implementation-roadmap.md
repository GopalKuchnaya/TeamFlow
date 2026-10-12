# TeamFlow — Implementation Roadmap

Each phase ends with checks (`npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`) and a written report. A phase starts only when the previous one has been
accepted.

## Dependency plan

| Area | Package | Phase | Why |
| ---- | ------- | ----- | --- |
| Server runtime | `express@5`, `mongoose@9`, `zod@4`, `argon2`, `jsonwebtoken`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit`, `pino`, `pino-http`, `dotenv` | 1 | Core API, security, logging |
| Server dev | `typescript@5.9`, `tsx`, `vitest`, `supertest`, `mongodb-memory-server`, `pino-pretty` | 1 | Build, watch mode, tests |
| Server realtime | `socket.io` | 4 | Realtime collaboration |
| Client runtime | `react@19`, `react-dom`, `react-router@7`, `@chakra-ui/react@3`, `@emotion/react`, `@tanstack/react-query@5`, `react-hook-form`, `@hookform/resolvers`, `zod@4`, `react-icons` | 1 | SPA foundation |
| Client dev | `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | 1 | Build and tests |
| Client board | `@dnd-kit/core`, `@dnd-kit/sortable` | 3 | Maintained, accessible drag-and-drop for React 19 |
| Client realtime | `socket.io-client` | 4 | Realtime |
| E2E | `@playwright/test` | 7 (smoke flows may appear earlier) | Critical-flow coverage |
| Lint | `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` | 1 | Static checks |

## Phase 0 — Repository audit & architecture ✅

- Audited the repository (it was empty) and the environment (no local MongoDB, so the
  `mongod` binary comes from Docker).
- Wrote `architecture.md`, `database-schema.md`, and this roadmap.

## Phase 1 — Foundation & authentication ✅ (scope)

In scope:

1. npm workspaces, strict TS configs, ESLint, dev/build/test scripts.
2. Server: env validation, logger, Mongo connection module, `app.ts`/`server.ts` split,
   helmet, CORS, body limit, request id, centralised errors, 404, health and readiness
   endpoints, graceful shutdown.
3. `User` and `Session` models; auth service (register, login, refresh with rotation and
   reuse detection, logout, me); Argon2id; JWT access tokens; `requireAuth` middleware; rate
   limits.
4. Client: Chakra theme, query client, API client with single-flight refresh, session query,
   login and registration pages, `RequireAuth`/`GuestOnly` guards, authenticated app shell
   (sidebar and mobile drawer, user menu with logout), home and account pages, 404 page,
   and route error boundary.
5. Tests: server unit and integration tests; client component tests.
6. `.env.example` files, README, and `docs/api.md`.

Out of scope: profile editing and password change (Phase 7 hardening or later), workspaces,
and everything after.

## Phase 2 — Workspaces & memberships

Depends on Phase 1 auth. Adds the workspace, membership, and invitation models; a
`loadMembership` middleware/policy; the permission matrix (architecture §6); workspace
switcher in the shell; members and invitations page; invitation acceptance page
(`/invite/:token`). Tests cover every row of the permission matrix and cross-workspace
access.

## Phase 3 — Projects & Kanban tasks

Depends on Phase 2 policies. Adds project CRUD, task CRUD, reorder endpoint (sparse positions
and rebalance), comments, a board using `@dnd-kit` with optimistic moves rolled back on error,
a task detail drawer, filters, and pagination.

## Phase 4 — Real-time collaboration

Depends on Phase 3 events. Adds Socket.io with access-token handshake auth, room joins
authorised by membership (`workspace:<id>`, `project:<id>`), events emitted after successful
REST writes, and client cache reconciliation keyed by id and `updatedAt` (idempotent). On
reconnect, the client re-subscribes and refetches.

## Phase 5 — Notifications & activity

Depends on Phases 3 and 4. Adds notification and activity models and best-effort writers,
unread count, a notifications page, a realtime push to `user:<id>`, and cursor-paginated feeds.

## Phase 6 — Search & analytics

Adds a workspace task search with an allowlisted filter/sort, dashboard aggregation (by
status, overdue, per-project progress), and `explain()` review of the heavy queries.

## Phase 7 — Testing & security hardening

Adds Playwright critical flows, authorization regression suites, rate-limit verification,
`npm audit`, a secret scan, production error handling review, and account settings
(profile update and password change, which revokes other sessions).

## Phase 8 — Deployment & portfolio readiness

Adds production env configuration, hosting (API + MongoDB Atlas + static SPA), HTTPS and
cookie configuration, seeded demo data, screenshots, a case study, and a smoke test.
