import type { Express } from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { MembershipModel } from '../../src/modules/memberships/membership.model.js';
import { WorkspaceModel } from '../../src/modules/workspaces/workspace.model.js';
import { resetTransactionSupportCache, withOptionalTransaction } from '../../src/utils/transaction.js';
import { as, seedWorkspace } from '../helpers/workspace.js';

/**
 * The rest of the suite runs on a standalone mongod (the no-transaction fallback). This file
 * runs the same multi-document operations on a replica set, where they use real transactions.
 */
let replSet: MongoMemoryReplSet;
let app: Express;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('teamflow-tx'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  resetTransactionSupportCache();
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('multi-document operations on a replica set', () => {
  it('runs work inside a session when transactions are supported', async () => {
    const session = await withOptionalTransaction((s) => Promise.resolve(s));
    expect(session).toBeDefined();
  });

  it('rolls back every write when transactional work fails', async () => {
    const ws = await seedWorkspace('Rollback');
    await expect(
      withOptionalTransaction(async (session) => {
        await MembershipModel.deleteMany({ workspaceId: ws.workspaceId }, { session }).exec();
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');
    expect(await MembershipModel.countDocuments({ workspaceId: ws.workspaceId })).toBe(3);
  });

  it('creates a workspace with its owner membership', async () => {
    const ws = await seedWorkspace('Seed');
    const res = await as(app, ws.owner).post('/api/v1/workspaces').send({ name: 'Tx' }).expect(201);
    const id = (res.body as { workspace: { id: string } }).workspace.id;
    expect(await MembershipModel.countDocuments({ workspaceId: id, role: 'owner' })).toBe(1);
  });

  it('transfers ownership atomically', async () => {
    const ws = await seedWorkspace('Transfer');
    await as(app, ws.owner)
      .post(`/api/v1/workspaces/${ws.workspaceId}/transfer-ownership`)
      .send({ userId: ws.admin.id })
      .expect(200);
    const owners = await MembershipModel.find({ workspaceId: ws.workspaceId, role: 'owner' }).lean();
    expect(owners.map((m) => m.userId.toString())).toEqual([ws.admin.id]);
  });

  it('leaves the workspace intact if a cascade delete fails mid-way', async () => {
    const ws = await seedWorkspace('Cascade');
    const spy = vi.spyOn(WorkspaceModel, 'deleteOne').mockImplementationOnce(() => {
      throw new Error('simulated failure');
    });
    await as(app, ws.owner).delete(`/api/v1/workspaces/${ws.workspaceId}`).expect(500);
    spy.mockRestore();
    // The memberships deleted before the failure were rolled back.
    expect(await MembershipModel.countDocuments({ workspaceId: ws.workspaceId })).toBe(3);
  });
});
