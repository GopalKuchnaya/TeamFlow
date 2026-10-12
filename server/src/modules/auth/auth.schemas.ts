import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
// Argon2 accepts long inputs, but an upper bound keeps hashing cost predictable.
export const PASSWORD_MAX_LENGTH = 128;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const loginSchema = z.object({
  email,
  // Only bound the length on login; strength rules apply at registration.
  password: z.string().min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
