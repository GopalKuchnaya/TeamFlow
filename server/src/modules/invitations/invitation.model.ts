import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const INVITABLE_ROLES = ['admin', 'member'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const invitationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // An invitation can never grant ownership.
    role: { type: String, enum: INVITABLE_ROLES, required: true },
    // SHA-256 of the 256-bit token. The raw token exists only in the invite link.
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Pending invitations per workspace, and "is there already a pending invite for this email?".
invitationSchema.index({ workspaceId: 1, email: 1, acceptedAt: 1, revokedAt: 1 });
invitationSchema.index({ workspaceId: 1, createdAt: -1 });
// Clean up 30 days after expiry; expiry itself is enforced in queries, not by TTL timing.
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });

export type Invitation = InferSchemaType<typeof invitationSchema>;
export type InvitationDocument = HydratedDocument<Invitation>;

export const InvitationModel = model('Invitation', invitationSchema);
