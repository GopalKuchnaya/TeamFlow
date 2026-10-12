import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api-client';

/**
 * Maps server-side field errors onto form fields. Returns the message to show as a
 * form-level alert when the error is not attributable to a known field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  let mapped = false;
  for (const detail of error.details) {
    const field = fields.find((name) => name === detail.path);
    if (field) {
      setError(field, { type: 'server', message: detail.message });
      mapped = true;
    }
  }
  return mapped ? null : error.message;
}
