import { isValidObjectId } from 'mongoose';
import { UserModel, type UserDocument } from './user.model.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(userId: string): Promise<UserDocument | null> {
  if (!isValidObjectId(userId)) return null;
  return UserModel.findById(userId).exec();
}

/** The only query that loads `passwordHash`. */
export async function findUserByEmailWithPassword(email: string): Promise<UserDocument | null> {
  return UserModel.findOne({ email: normalizeEmail(email) }).select('+passwordHash').exec();
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserDocument> {
  return UserModel.create({
    name: input.name,
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
  });
}
