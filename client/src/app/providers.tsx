import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/feedback/toaster';
import { authKeys } from '@/features/auth/api';
import { onSessionExpired } from '@/lib/api-client';
import { system } from '@/theme/system';

/** When the API reports the session is gone, drop cached data; the route guard redirects. */
function SessionExpiryBridge({ queryClient }: { queryClient: QueryClient }) {
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear();
        queryClient.setQueryData(authKeys.session, null);
      }),
    [queryClient],
  );
  return null;
}

export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <SessionExpiryBridge queryClient={queryClient} />
        {children}
        <Toaster />
      </QueryClientProvider>
    </ChakraProvider>
  );
}
