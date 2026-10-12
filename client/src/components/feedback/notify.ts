import { ApiError } from '@/lib/api-client';
import { toaster } from './toaster';

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/** Surfaces a failed mutation, including permission (403) errors, without losing context. */
export function notifyError(title: string, error: unknown): void {
  toaster.create({ type: 'error', title, description: errorMessage(error), closable: true });
}

export function notifySuccess(title: string, description?: string): void {
  toaster.create({ type: 'success', title, ...(description ? { description } : {}) });
}
