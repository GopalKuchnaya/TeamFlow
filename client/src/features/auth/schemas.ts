import { z } from 'zod';

// Mirrors server/src/modules/auth/auth.schemas.ts. The server remains authoritative.
const email = z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address'));

export const loginFormSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

export const registerFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
    email,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Za-z]/, 'Password must contain a letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
