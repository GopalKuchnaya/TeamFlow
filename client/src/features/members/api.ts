import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/features/workspaces/api';
import { apiRequest, apiRequestNoContent } from '@/lib/api-client';
import {
  createdInvitationSchema,
  invitationListSchema,
  memberListSchema,
  memberResponseSchema,
  type InvitableRole,
  type WorkspaceRole,
} from '@/types/api';

export interface MemberListParams {
  page: number;
  limit: number;
  role?: WorkspaceRole | undefined;
}

function toSearch(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}

export function useMembers(workspaceId: string, params: MemberListParams) {
  return useQuery({
    queryKey: [...workspaceKeys.members(workspaceId), params],
    queryFn: () =>
      apiRequest(`/workspaces/${workspaceId}/members?${toSearch({ ...params })}`, memberListSchema),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<WorkspaceRole, 'owner'> }) =>
      apiRequest(`/workspaces/${workspaceId}/members/${userId}`, memberResponseSchema, {
        method: 'PATCH',
        body: { role },
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequestNoContent(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}

export function useInvitations(workspaceId: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...workspaceKeys.invitations(workspaceId), page],
    queryFn: () => apiRequest(`/workspaces/${workspaceId}/invitations?${toSearch({ page, limit: 10 })}`, invitationListSchema),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: { email: string; role: InvitableRole }) =>
      apiRequest(`/workspaces/${workspaceId}/invitations`, createdInvitationSchema, { method: 'POST', body: values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(workspaceId) }),
  });
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiRequestNoContent(`/workspaces/${workspaceId}/invitations/${invitationId}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(workspaceId) }),
  });
}
