import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const membershipSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: WORKSPACE_ROLES, required: true },
  joinedAt: { type: Date, required: true, default: () => new Date() },
});

// Access check on every workspace-scoped request; also prevents duplicate memberships.
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
// "My workspaces", newest first.
membershipSchema.index({ userId: 1, joinedAt: -1 });
// Member list (paginated by join date) and role-filtered lookups.
membershipSchema.index({ workspaceId: 1, role: 1, joinedAt: 1 });
membershipSchema.index({ workspaceId: 1, joinedAt: 1 });

export type Membership = InferSchemaType<typeof membershipSchema>;
export type MembershipDocument = HydratedDocument<Membership>;

export const MembershipModel = model('WorkspaceMembership', membershipSchema);
