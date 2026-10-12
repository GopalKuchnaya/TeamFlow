# TeamFlow — Database Schema

MongoDB with Mongoose. All collections have `createdAt`/`updatedAt` maintained by Mongoose
`timestamps` unless noted otherwise. All ids are `ObjectId`. Status columns below:
**✅ implemented**, **📐 designed** (implemented in the phase noted).

Conventions:

- Every workspace-scoped document stores `workspaceId` directly (denormalised), so every
  query can be filtered by workspace and checked against membership without joins.
- Large or growing relationships are modelled as separate collections (memberships,
  comments, notifications, activity), never as unbounded embedded arrays. Bounded arrays
  (`assigneeIds` ≤ 20, `labels` ≤ 20) are validated.
- Responses are produced by explicit DTO mappers; internal fields (`passwordHash`,
  `tokenHash`, `__v`) are never serialised.

---

## users ✅ (Phase 1)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `name` | string | required, trimmed, 1–80 chars |
| `email` | string | required, trimmed, lower-cased, unique |
| `passwordHash` | string | required, Argon2id encoded hash, `select: false` |
| `avatarUrl` | string? | optional https URL |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes:

- `{ email: 1 }` **unique**: login lookup and duplicate-email enforcement. Emails are
  normalised (`trim().toLowerCase()`) before storage and lookup, so the index enforces
  case-insensitive uniqueness.

## sessions ✅ (Phase 1) — refresh-token store

Not in the original entity list. It is required by the refresh-token rotation and
revocation design (see `architecture.md` §5).

| Field | Type | Rules |
| ----- | ---- | ----- |
| `userId` | ObjectId → users | required |
| `familyId` | string | required; UUID shared by all tokens produced by rotation from one login |
| `tokenHash` | string | required, SHA-256 hex of the refresh token; the raw token is never stored |
| `expiresAt` | Date | required |
| `revokedAt` | Date? | set on rotation, logout, or reuse detection |
| `revokedReason` | `'rotated' \| 'logout' \| 'reuse_detected'`? | |
| `userAgent` | string? | truncated to 256 chars, for future "active sessions" UI |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes:

- `{ tokenHash: 1 }` **unique**: refresh lookup.
- `{ familyId: 1 }`: family revocation on logout and reuse.
- `{ userId: 1 }`: future "sign out everywhere".
- `{ expiresAt: 1 }` **TTL** (`expireAfterSeconds: 0`): MongoDB purges expired sessions
  automatically.

---

## workspaces ✅ (Phase 2)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `name` | string | 1–80 chars |
| `slug` | string | unique, lowercase `[a-z0-9-]`, ≤ 60 chars: slugified name (≤ 48) + `-` + 6 random hex chars; regenerated on the rare collision (3 attempts) |
| `description` | string | ≤ 500 chars, default `''` |
| `ownerId` | ObjectId → users | the current owner (mirrors the owner membership for quick display) |

Indexes: `{ slug: 1 }` unique.

## workspacememberships ✅ (Phase 2)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workspaceId` | ObjectId → workspaces | required |
| `userId` | ObjectId → users | required |
| `role` | `'owner' \| 'admin' \| 'member'` | required |
| `joinedAt` | Date | default now |

Indexes:

- `{ workspaceId: 1, userId: 1 }` **unique**: membership checks on every scoped request;
  prevents duplicate memberships.
- `{ userId: 1, joinedAt: -1 }`: "my workspaces" listing.
- `{ workspaceId: 1, joinedAt: 1 }`: member list sorted by join date (paginated).
- `{ workspaceId: 1, role: 1, joinedAt: 1 }`: member list filtered by role.

`joinedAt` is the only timestamp (no `createdAt`/`updatedAt`).

## invitations ✅ (Phase 2)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workspaceId` | ObjectId | required |
| `email` | string | normalised |
| `role` | `'admin' \| 'member'` | an invitation can never grant `owner` |
| `tokenHash` | string | SHA-256 of a 256-bit random token; the token is only shown in the invite link |
| `invitedBy` | ObjectId → users | |
| `expiresAt` | Date | default 7 days |
| `acceptedAt` | Date? | |
| `acceptedBy` | ObjectId → users? | the account that accepted |
| `revokedAt` | Date? | set on explicit revoke, or when the same email is re-invited |
| `createdAt` | Date | |

Indexes:

- `{ tokenHash: 1 }` **unique**: preview and accept lookups.
- `{ workspaceId: 1, email: 1, acceptedAt: 1, revokedAt: 1 }`: revoking a previous pending
  invite when the same email is re-invited.
- `{ workspaceId: 1, createdAt: -1 }`: pending-invitation list, newest first.
- `{ expiresAt: 1 }` **TTL** with `expireAfterSeconds` = 30 days: cleanup. Expiry itself is
  enforced in queries (`expiresAt > now`), not by TTL timing.

Acceptance checks, in order: the token exists and is not revoked (`404`), it is not accepted
(`409`), it has not expired (`410`), the email matches the signed-in account (`403`), and the
user is not already a member (`409`). The invitation is then claimed with a single
conditional update
(`findOneAndUpdate({ _id, acceptedAt: null, revokedAt: null, expiresAt: { $gt: now } })`), so
concurrent requests cannot both succeed. If the membership insert then fails, the claim is
released.

## projects 📐 (Phase 3)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workspaceId` | ObjectId | required |
| `name` | string | 1–120 chars |
| `description` | string | ≤ 2000 chars, default '' |
| `status` | `'active' \| 'archived'` | default `active` |
| `createdBy` | ObjectId → users | |

Indexes: `{ workspaceId: 1, status: 1, updatedAt: -1 }`: project list per workspace, filtered by
status and sorted by recent activity.

## tasks 📐 (Phase 3)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workspaceId` | ObjectId | must equal the project's `workspaceId` |
| `projectId` | ObjectId → projects | |
| `title` | string | 1–200 chars |
| `description` | string | ≤ 10 000 chars |
| `status` | `'todo' \| 'in_progress' \| 'review' \| 'done'` | |
| `priority` | `'low' \| 'medium' \| 'high' \| 'urgent'` | default `medium` |
| `assigneeIds` | ObjectId[] | ≤ 20, each must be a workspace member |
| `reporterId` | ObjectId → users | |
| `dueDate` | Date? | |
| `labels` | string[] | ≤ 20, each 1–30 chars, normalised lowercase |
| `position` | number | sparse ordering key within `(projectId, status)` column |

Indexes:

- `{ projectId: 1, status: 1, position: 1 }`: board columns in order.
- `{ workspaceId: 1, assigneeIds: 1, status: 1 }`: "my tasks" and dashboard per assignee.
- `{ workspaceId: 1, dueDate: 1 }` (partial: `dueDate` exists): overdue and upcoming queries.
- `{ workspaceId: 1, status: 1, priority: 1 }`: search filters.
- Text index `{ title: 'text', description: 'text' }` (Phase 6, scoped by `workspaceId` filter).

## comments 📐 (Phase 3)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workspaceId` | ObjectId | copied from the task |
| `taskId` | ObjectId → tasks | |
| `authorId` | ObjectId → users | |
| `body` | string | 1–5000 chars |

Indexes: `{ taskId: 1, createdAt: 1 }`: paginated thread.

## notifications 📐 (Phase 5)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `recipientId` | ObjectId → users | |
| `workspaceId` | ObjectId | |
| `type` | `'task_assigned' \| 'task_commented' \| 'task_updated' \| 'invitation'` | |
| `message` | string | |
| `entityType` | `'task' \| 'project' \| 'workspace'` | |
| `entityId` | ObjectId | |
| `readAt` | Date? | |
| `createdAt` | Date | |

Indexes: `{ recipientId: 1, createdAt: -1 }`: feed; `{ recipientId: 1, readAt: 1 }`: unread
count. Every query filters by `recipientId = caller`, which prevents IDOR.

## activitylogs 📐 (Phase 5)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workspaceId` | ObjectId | |
| `actorId` | ObjectId → users | |
| `entityType` | `'workspace' \| 'project' \| 'task' \| 'comment' \| 'member'` | |
| `entityId` | ObjectId | |
| `action` | string (e.g. `task.created`, `task.status_changed`) | |
| `metadata` | object | small, bounded (e.g. `{ from, to }`) |
| `createdAt` | Date | no `updatedAt`; activity records are append-only |

Indexes: `{ workspaceId: 1, createdAt: -1 }`: workspace feed;
`{ entityType: 1, entityId: 1, createdAt: -1 }`: per-task history.

---

## Pagination

Growing collections (tasks lists, comments, notifications, activity, members) use
pagination. Small, stable lists (a user's workspaces) are bounded by design.

- **Feeds** (notifications, activity, comments) use cursor pagination on `(createdAt, _id)`.
- **Searchable lists** (tasks, projects, members) use `page`/`limit` with `limit ≤ 100` and
  return `{ items, page, limit, total, totalPages }`.

## Cross-reference validation

Services validate every foreign reference against the caller's workspace before writing.
Examples: the task's project belongs to the workspace, assignees are members, a comment's
task belongs to the workspace. A mismatch returns `400 INVALID_REFERENCE` (or `404` when the
caller cannot see the target).
