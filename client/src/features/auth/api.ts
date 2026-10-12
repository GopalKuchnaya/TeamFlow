import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestNoContent, refreshSession } from '@/lib/api-client';
import { setAccessToken } from '@/lib/token-store';
import { meResponseSchema, sessionResponseSchema, type SessionResponse, type User } from '@/types/api';

export { useCurrentUser } from './current-user-context';
import type { LoginFormValues, RegisterFormValues } from './schemas';

export const authKeys = {
  session: ['auth', 'session'] as const,
  me: ['auth', 'me'] as const,
};

/**
 * The signed-in user, or `null` when signed out. On first load this restores the session
 * from the HttpOnly refresh cookie, which is what keeps users signed in across reloads.
 */
export function useSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async (): Promise<User | null> => (await refreshSession())?.user ?? null,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Fresh profile from the protected `/auth/me` endpoint. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiRequest('/auth/me', meResponseSchema),
    select: (data) => data.user,
  });
}

function useStartSession() {
  const queryClient = useQueryClient();
  return (session: SessionResponse) => {
    setAccessToken(session.accessToken);
    queryClient.setQueryData(authKeys.session, session.user);
  };
}

export function useLogin() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: (values: LoginFormValues) =>
      apiRequest('/auth/login', sessionResponseSchema, { method: 'POST', body: values, auth: false }),
    onSuccess: startSession,
  });
}

export function useRegister() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: ({ name, email, password }: RegisterFormValues) =>
      apiRequest('/auth/register', sessionResponseSchema, {
        method: 'POST',
        body: { name, email, password },
        auth: false,
      }),
    onSuccess: startSession,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequestNoContent('/auth/logout', { method: 'POST', auth: false, csrf: true }),
    // Clear local state even if the network call fails: the user asked to sign out.
    onSettled: () => {
      setAccessToken(null);
      queryClient.clear();
      queryClient.setQueryData(authKeys.session, null);
    },
  });
}
