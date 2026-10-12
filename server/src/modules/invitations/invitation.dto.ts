import type { Types } from 'mongoose';
import type { InvitableRole } from './invitation.model.js';

export interface InvitationDto {
  id: string;
  email: string;
  role: InvitableRole;
  invitedBy: { id: string; name: string } | null;
  expiresAt: string;
  createdAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

/** What the holder of an invite link may learn before accepting. */
export interface InvitationPreviewDto {
  workspaceName: string;
  email: string;
  role: InvitableRole;
  invitedByName: string | null;
  expiresAt: string;
  status: InvitationStatus;
}

interface InvitationLike {
  _id: Types.ObjectId;
  email: string;
  role: InvitableRole;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

export function toInvitationDto(invitation: InvitationLike, inviterName: string | undefined): InvitationDto {
  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    invitedBy: inviterName ? { id: invitation.invitedBy.toString(), name: inviterName } : null,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}
