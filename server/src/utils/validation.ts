import { type z } from 'zod';
import { AppError, type FieldIssue } from './app-error.js';

export function zodIssuesToFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/**
 * Validates untrusted request input against a schema and returns the typed, parsed value.
 * Unknown keys are stripped by the (non-passthrough) object schemas.
 */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', zodIssuesToFieldIssues(result.error));
  }
  return result.data;
}
