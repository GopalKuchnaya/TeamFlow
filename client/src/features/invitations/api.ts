import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/features/workspaces/api';
import { apiRequest } from '@/lib/api-client';
import { invitationPreviewResponseSchema, workspaceResponseSchema } from '@/types/api';

/** Public preview of an invite link (works signed out). */
export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ['invitations', 'preview', token],
    queryFn: () =>
      apiRequest('/invitations/preview', invitationPreviewResponseSchema, {
        method: 'POST',
        body: { token },
        auth: false,
      }),
    select: (data) => data.invitation,
    staleTime: 0,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) =>
      (await apiRequest('/invitations/accept', workspaceResponseSchema, { method: 'POST', body: { token } })).workspace,
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKeys.detail(workspace.id), { workspace });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}
