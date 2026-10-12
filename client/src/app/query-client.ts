import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors (validation, auth, permissions, not found) will not succeed on retry.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
