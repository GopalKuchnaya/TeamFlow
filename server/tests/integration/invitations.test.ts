import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { InvitationModel } from '../../src/modules/invitations/invitation.model.js';
import { MembershipModel } from '../../src/modules/memberships/membership.model.js';
import { hashToken } from '../../src/utils/crypto.js';
import { useTestDatabase } from '../helpers/database.js';
import { as, createTestUser, errorCode, seedWorkspace, type SeededWorkspace, type TestUser } from '../helpers/workspace.js';

useTestDatabase();

let app: Express;
let ws: SeededWorkspace;
let base: string;
beforeEach(async () => {
  app = createApp();
  ws = await seedWorkspace();
  base = `/api/v1/workspaces/${ws.workspaceId}/invitations`;
});

interface CreatedBody {
  token: string;
  invitation: { id: string; email: string; role: string; invitedBy: { id: string; name: string }; expiresAt: string };
}

async function invite(by: TestUser, email: string, role: 'admin' | 'member' = 'member'): Promise<CreatedBody> {
  const res = await as(app, by).post(base).send({ email, role }).expect(201);
  return res.body as CreatedBody;
}

describe('creating invitations', () => {
  it('lets the owner invite admins and members; stores only a token hash', async () => {
    const created = await invite(ws.owner, '  New.Person@Example.com ', 'admin');
    expect(created.invitation).toMatchObject({
      email: 'new.person@example.com',
      role: 'admin',
      invitedBy: { id: ws.owner.id, name: 'Owner' },
    });
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await InvitationModel.findById(created.invitation.id).lean();
    expect(stored?.tokenHash).toBe(hashToken(created.token));
    expect(JSON.stringify(stored)).not.toContain(created.token);
    const days = (new Date(created.invitation.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('lets admins invite members only', async () => {
    await invite(ws.admin, 'm@example.com', 'member');
    const res = await as(app, ws.admin).post(base).send({ email: 'a@example.com', role: 'admin' }).expect(403);
    expect(errorCode(res)).toBe('FORBIDDEN');
  });

  it('forbids members from inviting or viewing invitations', async () => {
    await as(app, ws.member).post(base).send({ email: 'x@example.com' }).expect(403);
    await as(app, ws.member).get(base).expect(403);
  });

  it('never allows inviting as owner', async () => {
    await as(app, ws.owner).post(base).send({ email: 'x@example.com', role: 'owner' }).expect(400);
  });

  it('rejects inviting an existing member', async () => {
    const res = await as(app, ws.owner).post(base).send({ email: ws.member.email.toUpperCase() }).expect(409);
    expect(errorCode(res)).toBe('ALREADY_MEMBER');
  });

  it('re-inviting the same email invalidates the previous link', async () => {
    const first = await invite(ws.owner, 'dup@example.com');
    await invite(ws.owner, 'dup@example.com');
    const invitee = await createTestUser('Dup', 'dup@example.com');
    const res = await as(app, invitee).post('/api/v1/invitations/accept').send({ token: first.token }).expect(404);
    expect(errorCode(res)).toBe('INVITATION_NOT_FOUND');

    const list = await as(app, ws.owner).get(base).expect(200);
    expect((list.body as { total: number }).total).toBe(1);
  });
});

describe('listing and revoking', () => {
  it('lists pending invitations only', async () => {
    const pending = await invite(ws.owner, 'pending@example.com');
    const expired = await invite(ws.owner, 'expired@example.com');
    const revoked = await invite(ws.owner, 'revoked@example.com');
    await InvitationModel.updateOne({ _id: expired.invitation.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await as(app, ws.admin).delete(`${base}/${revoked.invitation.id}`).expect(204);

    const res = await as(app, ws.admin).get(base).expect(200);
    const body = res.body as { items: { id: string }[]; total: number };
    expect(body.items.map((i) => i.id)).toEqual([pending.invitation.id]);
    expect(body.total).toBe(1);
  });

  it('cannot revoke an invitation from another workspace', async () => {
    const other = await seedWorkspace('Other');
    const res = await as(app, other.owner)
      .post(`/api/v1/workspaces/${other.workspaceId}/invitations`)
      .send({ email: 'x@example.com' })
      .expect(201);
    const otherInvitationId = (res.body as CreatedBody).invitation.id;

    await as(app, ws.owner).delete(`${base}/${otherInvitationId}`).expect(404);
    expect((await InvitationModel.findById(otherInvitationId).lean())?.revokedAt).toBeNull();
  });
});

describe('preview', () => {
  it('shows a signed-out invitee what they were invited to', async () => {
    const { token } = await invite(ws.owner, 'guest@example.com', 'admin');
    const res = await request(app).post('/api/v1/invitations/preview').send({ token }).expect(200);
    expect(res.body).toEqual({
      invitation: {
        workspaceName: 'Acme',
        email: 'guest@example.com',
        role: 'admin',
        invitedByName: 'Owner',
        expiresAt: expect.any(String),
        status: 'pending',
      },
    });
  });

  it('returns 404 for unknown tokens and rejects malformed ones', async () => {
    await request(app).post('/api/v1/invitations/preview').send({ token: 'x'.repeat(43) }).expect(404);
    await request(app).post('/api/v1/invitations/preview').send({ token: '../../etc' }).expect(400);
  });
});

describe('accepting', () => {
  let invitee: TestUser;
  let token: string;
  beforeEach(async () => {
    invitee = await createTestUser('Guest', 'guest@example.com');
    ({ token } = await invite(ws.owner, 'guest@example.com', 'admin'));
  });

  const accept = (user: TestUser, t = token) => as(app, user).post('/api/v1/invitations/accept').send({ token: t });

  it('joins the workspace with the invited role and grants access', async () => {
    const res = await accept(invitee).expect(200);
    expect(res.body).toMatchObject({ workspace: { id: ws.workspaceId, name: 'Acme', role: 'admin' } });
    await as(app, invitee).get(`/api/v1/workspaces/${ws.workspaceId}`).expect(200);
    const stored = await InvitationModel.findOne({ tokenHash: hashToken(token) }).lean();
    expect(stored?.acceptedBy?.toString()).toBe(invitee.id);
  });

  it('requires authentication', async () => {
    await request(app).post('/api/v1/invitations/accept').send({ token }).expect(401);
  });

  it('cannot be accepted twice', async () => {
    await accept(invitee).expect(200);
    const res = await accept(invitee).expect(409);
    expect(errorCode(res)).toBe('INVITATION_ALREADY_USED');
  });

  it('can be used only once under concurrent requests', async () => {
    const results = await Promise.all([accept(invitee), accept(invitee), accept(invitee)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await MembershipModel.countDocuments({ workspaceId: ws.workspaceId, userId: invitee.id })).toBe(1);
  });

  it('rejects expired invitations with 410', async () => {
    await InvitationModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await accept(invitee).expect(410);
    expect(errorCode(res)).toBe('INVITATION_EXPIRED');
    expect(await MembershipModel.countDocuments({ userId: invitee.id })).toBe(0);
  });

  it('rejects revoked invitations', async () => {
    const stored = await InvitationModel.findOne({ tokenHash: hashToken(token) }).lean();
    await as(app, ws.owner).delete(`${base}/${String(stored?._id)}`).expect(204);
    const res = await accept(invitee).expect(404);
    expect(errorCode(res)).toBe('INVITATION_NOT_FOUND');
  });

  it('rejects a user whose email does not match the invitation', async () => {
    const res = await accept(ws.outsider).expect(403);
    expect(errorCode(res)).toBe('INVITATION_EMAIL_MISMATCH');
    expect(await MembershipModel.countDocuments({ userId: ws.outsider.id })).toBe(0);
    // The invitation is still usable by the intended recipient.
    await accept(invitee).expect(200);
  });

  it('rejects users who are already members without consuming the invitation', async () => {
    await MembershipModel.create({ workspaceId: ws.workspaceId, userId: invitee.id, role: 'member' });
    const res = await accept(invitee).expect(409);
    expect(errorCode(res)).toBe('ALREADY_MEMBER');
    expect((await InvitationModel.findOne({ tokenHash: hashToken(token) }).lean())?.acceptedAt).toBeNull();
  });

  it('is invalidated when the workspace is deleted', async () => {
    await as(app, ws.owner).delete(`/api/v1/workspaces/${ws.workspaceId}`).expect(204);
    await accept(invitee).expect(404);
  });
});
