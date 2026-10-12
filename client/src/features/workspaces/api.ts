import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestNoContent } from '@/lib/api-client';
import { workspaceListSchema, workspaceResponseSchema, type Workspace } from '@/types/api';

/** Large enough for every realistic membership count; the API caps pages at 100. */
const WORKSPACE_LIST_LIMIT = 100;

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (workspaceId: string) => [...workspaceKeys.all, 'detail', workspaceId] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, 'detail', workspaceId, 'members'] as const,
  invitations: (workspaceId: string) => [...workspaceKeys.all, 'detail', workspaceId, 'invitations'] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => apiRequest(`/workspaces?limit=${WORKSPACE_LIST_LIMIT}`, workspaceListSchema),
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => apiRequest(`/workspaces/${workspaceId}`, workspaceResponseSchema),
    select: (data) => data.workspace,
  });
}

export interface WorkspaceFormValues {
  name: string;
  description: string;
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: WorkspaceFormValues) =>
      (await apiRequest('/workspaces', workspaceResponseSchema, { method: 'POST', body: values })).workspace,
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKeys.detail(workspace.id), { workspace });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

function useApplyWorkspace() {
  const queryClient = useQueryClient();
  return (workspace: Workspace) => {
    queryClient.setQueryData(workspaceKeys.detail(workspace.id), { workspace });
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
  };
}

export function useUpdateWorkspace(workspaceId: string) {
  const applyWorkspace = useApplyWorkspace();
  return useMutation({
    mutationFn: async (values: WorkspaceFormValues) =>
      (await apiRequest(`/workspaces/${workspaceId}`, workspaceResponseSchema, { method: 'PATCH', body: values }))
        .workspace,
    onSuccess: applyWorkspace,
  });
}

export function useTransferOwnership(workspaceId: string) {
  const queryClient = useQueryClient();
  const applyWorkspace = useApplyWorkspace();
  return useMutation({
    mutationFn: async (userId: string) =>
      (
        await apiRequest(`/workspaces/${workspaceId}/transfer-ownership`, workspaceResponseSchema, {
          method: 'POST',
          body: { userId },
        })
      ).workspace,
    onSuccess: (workspace) => {
      applyWorkspace(workspace);
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
    },
  });
}

/** Clears cached data for a workspace the user no longer has access to. */
function useForgetWorkspace() {
  const queryClient = useQueryClient();
  return (workspaceId: string) => {
    queryClient.removeQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
  };
}

export function useDeleteWorkspace(workspaceId: string) {
  const forget = useForgetWorkspace();
  return useMutation({
    mutationFn: () => apiRequestNoContent(`/workspaces/${workspaceId}`, { method: 'DELETE' }),
    onSuccess: () => { forget(workspaceId); },
  });
}

export function useLeaveWorkspace(workspaceId: string, userId: string) {
  const forget = useForgetWorkspace();
  return useMutation({
    mutationFn: () => apiRequestNoContent(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => { forget(workspaceId); },
  });
}
