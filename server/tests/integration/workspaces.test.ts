import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { InvitationModel } from '../../src/modules/invitations/invitation.model.js';
import { MembershipModel } from '../../src/modules/memberships/membership.model.js';
import { WorkspaceModel } from '../../src/modules/workspaces/workspace.model.js';
import { useTestDatabase } from '../helpers/database.js';
import { as, createTestUser, errorCode, seedWorkspace, type SeededWorkspace } from '../helpers/workspace.js';

useTestDatabase();

let app: Express;
beforeEach(() => {
  app = createApp();
});

interface WorkspaceBody {
  workspace: { id: string; name: string; slug: string; description: string; ownerId: string; role: string };
}

describe('workspace creation and listing', () => {
  it('creates a workspace and makes the creator its owner', async () => {
    const alice = await createTestUser('Alice');
    const res = await as(app, alice).post('/api/v1/workspaces').send({ name: '  Design Team ', description: 'UI work' }).expect(201);
    const { workspace } = res.body as WorkspaceBody;

    expect(workspace).toMatchObject({ name: 'Design Team', description: 'UI work', ownerId: alice.id, role: 'owner' });
    expect(workspace.slug).toMatch(/^design-team-[a-f0-9]{6}$/);
    expect(await MembershipModel.countDocuments({ workspaceId: workspace.id, userId: alice.id, role: 'owner' })).toBe(1);
  });

  it('validates input', async () => {
    const alice = await createTestUser('Alice');
    const res = await as(app, alice).post('/api/v1/workspaces').send({ name: '', description: 'x'.repeat(501) }).expect(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/workspaces').expect(401);
    await request(app).post('/api/v1/workspaces').send({ name: 'X' }).expect(401);
  });

  it('lists only the caller’s workspaces with their role, paginated', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    for (const name of ['One', 'Two', 'Three']) {
      await as(app, alice).post('/api/v1/workspaces').send({ name }).expect(201);
    }
    await as(app, bob).post('/api/v1/workspaces').send({ name: 'Bob’s' }).expect(201);

    const page1 = await as(app, alice).get('/api/v1/workspaces?limit=2').expect(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const body = page1.body as { items: { name: string; role: string }[] };
    expect(body.items.map((w) => w.name)).toEqual(['Three', 'Two']);
    expect(body.items.every((w) => w.role === 'owner')).toBe(true);

    const page2 = await as(app, alice).get('/api/v1/workspaces?limit=2&page=2').expect(200);
    expect((page2.body as { items: { name: string }[] }).items.map((w) => w.name)).toEqual(['One']);
  });

  it('rejects out-of-range pagination', async () => {
    const alice = await createTestUser('Alice');
    await as(app, alice).get('/api/v1/workspaces?limit=1000').expect(400);
    await as(app, alice).get('/api/v1/workspaces?page=0').expect(400);
  });
});

describe('workspace access control', () => {
  let ws: SeededWorkspace;
  beforeEach(async () => {
    ws = await seedWorkspace();
  });

  it.each(['owner', 'admin', 'member'] as const)('lets a %s view the workspace with their role', async (role) => {
    const res = await as(app, ws[role]).get(`/api/v1/workspaces/${ws.workspaceId}`).expect(200);
    expect((res.body as WorkspaceBody).workspace.role).toBe(role);
  });

  it('returns 404 (not 403) to non-members for every workspace route', async () => {
    const base = `/api/v1/workspaces/${ws.workspaceId}`;
    const client = as(app, ws.outsider);
    const responses = await Promise.all([
      client.get(base),
      client.patch(base).send({ name: 'Hacked' }),
      client.delete(base),
      client.post(`${base}/transfer-ownership`).send({ userId: ws.outsider.id }),
      client.get(`${base}/members`),
      client.patch(`${base}/members/${ws.member.id}`).send({ role: 'admin' }),
      client.delete(`${base}/members/${ws.member.id}`),
      client.get(`${base}/invitations`),
      client.post(`${base}/invitations`).send({ email: 'x@example.com' }),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(errorCode(res)).toBe('NOT_FOUND');
    }
    expect(await WorkspaceModel.findById(ws.workspaceId).lean()).toMatchObject({ name: 'Acme' });
  });

  it('treats an unknown workspace id exactly like an inaccessible one', async () => {
    const res = await as(app, ws.owner).get('/api/v1/workspaces/0123456789abcdef01234567').expect(404);
    expect(errorCode(res)).toBe('NOT_FOUND');
  });

  it('rejects malformed ids with 400', async () => {
    await as(app, ws.owner).get('/api/v1/workspaces/not-an-id').expect(400);
  });

  it('only lets the owner update settings', async () => {
    for (const role of ['admin', 'member'] as const) {
      const res = await as(app, ws[role]).patch(`/api/v1/workspaces/${ws.workspaceId}`).send({ name: 'Nope' }).expect(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    }
    const res = await as(app, ws.owner)
      .patch(`/api/v1/workspaces/${ws.workspaceId}`)
      .send({ name: 'Acme 2', description: 'New' })
      .expect(200);
    expect((res.body as WorkspaceBody).workspace).toMatchObject({ name: 'Acme 2', description: 'New' });
  });

  it('requires at least one field on update', async () => {
    await as(app, ws.owner).patch(`/api/v1/workspaces/${ws.workspaceId}`).send({}).expect(400);
  });

  it('ignores attempts to change protected fields such as ownerId', async () => {
    await as(app, ws.owner)
      .patch(`/api/v1/workspaces/${ws.workspaceId}`)
      .send({ name: 'Acme', ownerId: ws.member.id })
      .expect(200);
    const workspace = await WorkspaceModel.findById(ws.workspaceId).lean();
    expect(workspace?.ownerId.toString()).toBe(ws.owner.id);
  });

  it('only lets the owner delete, and deletion cascades to memberships and invitations', async () => {
    await as(app, ws.owner).post(`/api/v1/workspaces/${ws.workspaceId}/invitations`).send({ email: 'new@example.com' }).expect(201);
    for (const role of ['admin', 'member'] as const) {
      await as(app, ws[role]).delete(`/api/v1/workspaces/${ws.workspaceId}`).expect(403);
    }
    await as(app, ws.owner).delete(`/api/v1/workspaces/${ws.workspaceId}`).expect(204);

    expect(await WorkspaceModel.countDocuments({ _id: ws.workspaceId })).toBe(0);
    expect(await MembershipModel.countDocuments({ workspaceId: ws.workspaceId })).toBe(0);
    expect(await InvitationModel.countDocuments({ workspaceId: ws.workspaceId })).toBe(0);
    await as(app, ws.member).get(`/api/v1/workspaces/${ws.workspaceId}`).expect(404);
  });
});

describe('ownership transfer', () => {
  let ws: SeededWorkspace;
  beforeEach(async () => {
    ws = await seedWorkspace();
  });

  it('makes the target the owner and demotes the previous owner to admin', async () => {
    const res = await as(app, ws.owner)
      .post(`/api/v1/workspaces/${ws.workspaceId}/transfer-ownership`)
      .send({ userId: ws.member.id })
      .expect(200);
    expect((res.body as WorkspaceBody).workspace).toMatchObject({ ownerId: ws.member.id, role: 'admin' });

    const roles = await MembershipModel.find({ workspaceId: ws.workspaceId }).lean();
    const roleOf = (id: string) => roles.find((m) => m.userId.toString() === id)?.role;
    expect(roleOf(ws.member.id)).toBe('owner');
    expect(roleOf(ws.owner.id)).toBe('admin');
    expect(roles.filter((m) => m.role === 'owner')).toHaveLength(1);

    // The new owner now holds owner-only powers; the old one does not.
    await as(app, ws.member).patch(`/api/v1/workspaces/${ws.workspaceId}`).send({ name: 'Mine' }).expect(200);
    await as(app, ws.owner).patch(`/api/v1/workspaces/${ws.workspaceId}`).send({ name: 'Back' }).expect(403);
  });

  it('is owner-only and requires the target to be a member', async () => {
    await as(app, ws.admin).post(`/api/v1/workspaces/${ws.workspaceId}/transfer-ownership`).send({ userId: ws.admin.id }).expect(403);
    await as(app, ws.owner).post(`/api/v1/workspaces/${ws.workspaceId}/transfer-ownership`).send({ userId: ws.outsider.id }).expect(404);
    await as(app, ws.owner).post(`/api/v1/workspaces/${ws.workspaceId}/transfer-ownership`).send({ userId: ws.owner.id }).expect(400);
  });
});
