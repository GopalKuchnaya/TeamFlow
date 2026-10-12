import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const REVOKED_REASONS = ['rotated', 'logout', 'reuse_detected'] as const;
export type RevokedReason = (typeof REVOKED_REASONS)[number];

/** A refresh-token record. Only the SHA-256 hash of the token is stored. */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, enum: REVOKED_REASONS, default: null },
    userAgent: { type: String, maxlength: 256 },
  },
  { timestamps: true },
);

// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<Session>;

export const SessionModel = model('Session', sessionSchema);
