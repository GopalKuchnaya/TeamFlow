import type { Express } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { MembershipModel } from '../../src/modules/memberships/membership.model.js';
import { useTestDatabase } from '../helpers/database.js';
import { as, createTestUser, errorCode, seedWorkspace, type SeededWorkspace } from '../helpers/workspace.js';

useTestDatabase();

let app: Express;
let ws: SeededWorkspace;
let base: string;
beforeEach(async () => {
  app = createApp();
  ws = await seedWorkspace();
  base = `/api/v1/workspaces/${ws.workspaceId}/members`;
});

interface MembersBody {
  items: { userId: string; name: string; email: string; role: string; joinedAt: string }[];
  total: number;
}

async function roleOf(userId: string) {
  return (await MembershipModel.findOne({ workspaceId: ws.workspaceId, userId }).lean())?.role;
}

describe('GET members', () => {
  it.each(['owner', 'admin', 'member'] as const)('is visible to a %s, with user details and no secrets', async (role) => {
    const res = await as(app, ws[role]).get(base).expect(200);
    const body = res.body as MembersBody;
    expect(body.total).toBe(3);
    expect(body.items.map((m) => m.role).sort()).toEqual(['admin', 'member', 'owner']);
    expect(body.items[0]).toEqual({
      userId: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      avatarUrl: null,
      role: expect.any(String),
      joinedAt: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash/);
  });

  it('supports role filtering and pagination, rejecting unknown filters', async () => {
    const res = await as(app, ws.member).get(`${base}?role=admin`).expect(200);
    expect((res.body as MembersBody).items.map((m) => m.userId)).toEqual([ws.admin.id]);

    const paged = await as(app, ws.member).get(`${base}?limit=2&page=2`).expect(200);
    expect(paged.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect((paged.body as MembersBody).items).toHaveLength(1);

    await as(app, ws.member).get(`${base}?role=superuser`).expect(400);
  });
});

describe('PATCH member role', () => {
  it('lets the owner promote and demote non-owners', async () => {
    const res = await as(app, ws.owner).patch(`${base}/${ws.member.id}`).send({ role: 'admin' }).expect(200);
    expect(res.body).toMatchObject({ member: { userId: ws.member.id, role: 'admin' } });
    await as(app, ws.owner).patch(`${base}/${ws.admin.id}`).send({ role: 'member' }).expect(200);
    expect(await roleOf(ws.admin.id)).toBe('member');
  });

  it('forbids admins and members from changing roles', async () => {
    await as(app, ws.admin).patch(`${base}/${ws.member.id}`).send({ role: 'admin' }).expect(403);
    await as(app, ws.member).patch(`${base}/${ws.member.id}`).send({ role: 'admin' }).expect(403);
    expect(await roleOf(ws.member.id)).toBe('member');
  });

  it('never grants or removes ownership through role changes', async () => {
    await as(app, ws.owner).patch(`${base}/${ws.member.id}`).send({ role: 'owner' }).expect(400);
    await as(app, ws.owner).patch(`${base}/${ws.owner.id}`).send({ role: 'member' }).expect(403);
    expect(await roleOf(ws.owner.id)).toBe('owner');
  });

  it('returns 404 for users who are not members', async () => {
    const res = await as(app, ws.owner).patch(`${base}/${ws.outsider.id}`).send({ role: 'admin' }).expect(404);
    expect(errorCode(res)).toBe('NOT_FOUND');
  });
});

describe('DELETE member (remove / leave)', () => {
  it('lets the owner remove admins and members', async () => {
    await as(app, ws.owner).delete(`${base}/${ws.admin.id}`).expect(204);
    await as(app, ws.owner).delete(`${base}/${ws.member.id}`).expect(204);
    expect(await MembershipModel.countDocuments({ workspaceId: ws.workspaceId })).toBe(1);
    // A removed member immediately loses access.
    await as(app, ws.member).get(`/api/v1/workspaces/${ws.workspaceId}`).expect(404);
  });

  it('lets admins remove members but not other admins or the owner', async () => {
    const otherAdmin = await createTestUser('Admin2');
    await MembershipModel.create({ workspaceId: ws.workspaceId, userId: otherAdmin.id, role: 'admin' });

    await as(app, ws.admin).delete(`${base}/${otherAdmin.id}`).expect(403);
    await as(app, ws.admin).delete(`${base}/${ws.owner.id}`).expect(403);
    await as(app, ws.admin).delete(`${base}/${ws.member.id}`).expect(204);
  });

  it('forbids members from removing others', async () => {
    await as(app, ws.member).delete(`${base}/${ws.admin.id}`).expect(403);
    expect(await roleOf(ws.admin.id)).toBe('admin');
  });

  it('lets admins and members leave, but not the owner', async () => {
    await as(app, ws.member).delete(`${base}/${ws.member.id}`).expect(204);
    await as(app, ws.admin).delete(`${base}/${ws.admin.id}`).expect(204);
    const res = await as(app, ws.owner).delete(`${base}/${ws.owner.id}`).expect(403);
    expect(errorCode(res)).toBe('FORBIDDEN');
    expect(await roleOf(ws.owner.id)).toBe('owner');
  });
});

describe('cross-workspace isolation', () => {
  it('cannot act on another workspace’s members through a workspace you belong to', async () => {
    const other = await seedWorkspace('Other');
    // Owner of `ws` targets a member of `other` via ws's URL: not a member there → 404.
    await as(app, ws.owner).delete(`${base}/${other.member.id}`).expect(404);
    await as(app, ws.owner).patch(`${base}/${other.member.id}`).send({ role: 'admin' }).expect(404);
    // And cannot reach `other` directly.
    await as(app, ws.owner).get(`/api/v1/workspaces/${other.workspaceId}/members`).expect(404);
    expect(await MembershipModel.countDocuments({ workspaceId: other.workspaceId })).toBe(3);
  });

  it('enforces membership uniqueness at the database level', async () => {
    await expect(
      MembershipModel.create({ workspaceId: ws.workspaceId, userId: ws.member.id, role: 'admin' }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
