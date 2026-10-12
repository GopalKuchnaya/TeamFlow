import type { Types } from 'mongoose';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface UserLike {
  _id: Types.ObjectId;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: Date;
}

/** Explicit allowlist of user fields that may leave the server. */
export function toUserDto(user: UserLike): UserDto {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
