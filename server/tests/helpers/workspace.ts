import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { signAccessToken } from '../../src/modules/auth/token.service.js';
import { MembershipModel, type WorkspaceRole } from '../../src/modules/memberships/membership.model.js';
import { UserModel } from '../../src/modules/users/user.model.js';
import { WorkspaceModel } from '../../src/modules/workspaces/workspace.model.js';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

/** Inserts a user directly (skipping Argon2 for speed) and signs an access token for them. */
export async function createTestUser(name: string, email?: string): Promise<TestUser> {
  const user = await UserModel.create({
    name,
    email: email ?? `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`,
    passwordHash: 'not-a-real-hash',
  });
  const id = user._id.toString();
  return { id, name, email: user.email, token: signAccessToken(id).token };
}

export interface SeededWorkspace {
  workspaceId: string;
  owner: TestUser;
  admin: TestUser;
  member: TestUser;
  outsider: TestUser;
}

/** A workspace with one user per role plus an authenticated non-member. */
export async function seedWorkspace(name = 'Acme'): Promise<SeededWorkspace> {
  const [owner, admin, member, outsider] = await Promise.all([
    createTestUser('Owner'),
    createTestUser('Admin'),
    createTestUser('Member'),
    createTestUser('Outsider'),
  ]);
  const workspace = await WorkspaceModel.create({ name, slug: `${name.toLowerCase()}-${randomUUID().slice(0, 6)}`, ownerId: owner.id });
  const roles: [TestUser, WorkspaceRole][] = [
    [owner, 'owner'],
    [admin, 'admin'],
    [member, 'member'],
  ];
  await MembershipModel.insertMany(roles.map(([user, role]) => ({ workspaceId: workspace._id, userId: user.id, role })));
  return { workspaceId: workspace._id.toString(), owner, admin, member, outsider };
}

/** Supertest client that authenticates every request as `user`. */
export function as(app: Express, user: TestUser) {
  const auth = { Authorization: `Bearer ${user.token}` };
  return {
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string) => request(app).post(url).set(auth),
    patch: (url: string) => request(app).patch(url).set(auth),
    delete: (url: string) => request(app).delete(url).set(auth),
  };
}

export interface ErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

export function errorCode(res: request.Response): string {
  return (res.body as ErrorBody).error.code;
}
