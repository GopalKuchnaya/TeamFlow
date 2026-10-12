import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    // Mirrors the single `owner` membership for cheap display; memberships remain authoritative.
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export type Workspace = InferSchemaType<typeof workspaceSchema>;
export type WorkspaceDocument = HydratedDocument<Workspace>;

export const WorkspaceModel = model('Workspace', workspaceSchema);
