import { createContext, useContext } from 'react';
import type { User } from '@/types/api';

/**
 * Provided by `RequireAuth` from the session it has already verified. Reading the user from
 * context (rather than the session query) means components inside the authenticated shell
 * never observe the transient `null` session while sign-out redirects away.
 */
export const CurrentUserContext = createContext<User | null>(null);

export function useCurrentUser(): User {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used within RequireAuth');
  return user;
}
