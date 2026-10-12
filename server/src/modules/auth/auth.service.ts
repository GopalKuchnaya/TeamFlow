import type { Logger } from 'pino';
import { AppError } from '../../utils/app-error.js';
import { toUserDto, type UserDto } from '../users/user.dto.js';
import { createUser, findUserByEmailWithPassword, findUserById } from '../users/user.service.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { RequestContext } from './auth.types.js';
import { hashPassword, simulatePasswordVerification, verifyPassword } from './password.js';
import { issueRefreshToken, revokeSessionByToken, rotateRefreshToken, type IssuedRefreshToken } from './session.service.js';
import { signAccessToken } from './token.service.js';
import { isDuplicateKeyError } from '../../utils/mongo.js';

export interface AuthResult {
  user: UserDto;
  accessToken: string;
  expiresIn: number;
  refreshToken: IssuedRefreshToken;
}


async function startSession(user: UserDto, context: RequestContext): Promise<AuthResult> {
  const access = signAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id, context);
  return { user, accessToken: access.token, expiresIn: access.expiresIn, refreshToken };
}

export async function register(input: RegisterInput, context: RequestContext): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    // The unique index on email is the source of truth, so concurrent sign-ups cannot both succeed.
    const user = await createUser({ name: input.name, email: input.email, passwordHash });
    return await startSession(toUserDto(user), context);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists', [
        { path: 'email', message: 'An account with this email already exists' },
      ]);
    }
    throw error;
  }
}

export async function login(input: LoginInput, context: RequestContext): Promise<AuthResult> {
  const user = await findUserByEmailWithPassword(input.email);
  if (!user) {
    await simulatePasswordVerification(input.password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  return startSession(toUserDto(user), context);
}

export async function refresh(
  rawRefreshToken: string | undefined,
  context: RequestContext,
  logger: Logger,
): Promise<AuthResult> {
  if (!rawRefreshToken) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid or has expired');
  }
  const { userId, refreshToken } = await rotateRefreshToken(rawRefreshToken, context, logger);
  const user = await findUserById(userId);
  if (!user) {
    await revokeSessionByToken(refreshToken.token);
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid or has expired');
  }
  const access = signAccessToken(userId);
  return { user: toUserDto(user), accessToken: access.token, expiresIn: access.expiresIn, refreshToken };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (rawRefreshToken) await revokeSessionByToken(rawRefreshToken);
}

export async function getCurrentUser(userId: string): Promise<UserDto> {
  const user = await findUserById(userId);
  if (!user) throw AppError.unauthenticated();
  return toUserDto(user);
}
