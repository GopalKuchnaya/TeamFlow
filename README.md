# TeamFlow

A production-style project management SaaS for teams: workspaces, Kanban projects,
real-time collaboration, and notifications. It is built with the MERN stack in strict
TypeScript.

> **Status: Phase 1 (foundation and authentication) complete.** Workspaces, projects,
> tasks, realtime updates, and notifications are planned. See
> [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md).

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Client | React 19, TypeScript, Vite, Chakra UI v3, React Router 7, TanStack Query 5, React Hook Form + Zod |
| Server | Node.js 22, Express 5, TypeScript, Mongoose 9 (MongoDB), Zod, Argon2id, JWT, pino |
| Tests | Vitest, React Testing Library, Supertest, mongodb-memory-server |

## What works today

- Registration, login, logout, and current-user retrieval.
- Short-lived access tokens held **in memory only**, plus rotating refresh tokens in an
  `HttpOnly` cookie with reuse detection and server-side revocation. The session survives
  page reloads.
- Argon2id password hashing, login brute-force rate limiting, timing-equalised login
  errors, CORS allowlist, helmet security headers, body-size limits, and anti-CSRF header on
  cookie endpoints.
- Centralised error handling with a consistent JSON envelope, request ids, structured logs
  with secret redaction, and liveness/readiness health checks.
- Protected client routing, an authenticated app shell with a desktop sidebar and mobile
  drawer, login/registration with field-level server errors, an account page, and 404 and
  error pages.

## Repository layout

```
client/   React SPA (Vite)
server/   Express API
docs/     architecture.md · database-schema.md · api.md · implementation-roadmap.md
```

## Prerequisites

- **Node.js 22+** (see `.nvmrc`) and npm 10+.
- **MongoDB 7+** for local development. Any of these works:
  - Docker: `docker run -d --name teamflow-mongo -p 27017:27017 mongo:7`
  - A local `mongod` install
  - A free MongoDB Atlas cluster (set `MONGODB_URI` accordingly)

Tests do **not** need a running MongoDB: they start an in-memory `mongod` automatically.

## Getting started

```bash
# 1. Install all workspaces from the repository root
npm install

# 2. Configure environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env   # optional; defaults work for local dev
#    Then set JWT_ACCESS_SECRET in server/.env to a long random value:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Start MongoDB (see prerequisites), then run API + client together
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000/api/v1> (health: `/api/v1/health/ready`)

In development, Vite proxies `/api` to the API, so the SPA and API share an origin and the
refresh cookie works without cross-site configuration.

## Scripts (run from the repository root)

| Command | Description |
| ------- | ----------- |
| `npm run dev` | API (tsx watch) and client (Vite) in parallel |
| `npm run build` | Compile the server to `server/dist` and build the client to `client/dist` |
| `npm run typecheck` | Strict TypeScript checks for both apps |
| `npm run lint` | ESLint (`typescript-eslint` strict, type-checked) |
| `npm test` | Server (unit + integration) and client (component) tests |

Per-app scripts are also available, e.g. `npm run test -w server`, `npm run start -w server`
(runs the compiled API).

### Tests in offline or sandboxed environments

`mongodb-memory-server` downloads a `mongod` binary on first use. If your network blocks
that download, point it at a local binary:

```bash
MONGOMS_SYSTEM_BINARY=/path/to/mongod npm test
```

## Environment variables

Server variables are documented in [`server/.env.example`](server/.env.example) and validated
at start-up (the process exits with a list of invalid variable names, never their values).
The client only reads `VITE_API_URL`. Everything prefixed `VITE_` is public, so never put
secrets there.

## Documentation

- [Architecture, decisions, auth design, and permission matrix](docs/architecture.md)
- [Database schema and indexes](docs/database-schema.md)
- [API reference](docs/api.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
