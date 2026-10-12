import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { useSession } from '@/features/auth/api';
import { CurrentUserContext } from '@/features/auth/current-user-context';

export interface RedirectState {
  from?: string;
}

/**
 * Navigation guard for signed-in areas. This is a UX convenience only: every protected
 * API endpoint independently verifies the access token.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <LoadingState label="Restoring your session…" fullPage />;
  if (session.isError) {
    return (
      <ErrorState
        fullPage
        title="We couldn't reach TeamFlow"
        message={session.error.message}
        onRetry={() => void session.refetch()}
      />
    );
  }
  if (!session.data) {
    const state: RedirectState = { from: `${location.pathname}${location.search}` };
    return <Navigate to="/login" replace state={state} />;
  }
  return <CurrentUserContext value={session.data}>{children}</CurrentUserContext>;
}

export function safeRedirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string') {
    // Only allow same-app relative paths (no protocol-relative or absolute URLs).
    if (state.from.startsWith('/') && !state.from.startsWith('//')) return state.from;
  }
  return '/';
}

/** Keeps signed-in users away from the login and registration pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <LoadingState fullPage />;
  if (session.data) return <Navigate to={safeRedirectTarget(location.state)} replace />;
  return children;
}
