import { Button } from '@chakra-ui/react';
import { useEffect } from 'react';
import { Outlet, Link as RouterLink, useParams } from 'react-router';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { useCurrentUser } from '@/features/auth/api';
import { ApiError } from '@/lib/api-client';
import { useWorkspace } from '../api';
import { CurrentWorkspaceContext, rememberWorkspace } from '../current-workspace';

export function WorkspaceLayout() {
  const { workspaceId = '' } = useParams();
  const user = useCurrentUser();
  const workspace = useWorkspace(workspaceId);

  useEffect(() => {
    if (workspace.data) rememberWorkspace(user.id, workspace.data.id);
  }, [user.id, workspace.data]);

  if (workspace.isPending) return <LoadingState label="Loading workspace…" />;
  if (workspace.isError) {
    const inaccessible =
      workspace.error instanceof ApiError && (workspace.error.status === 404 || workspace.error.status === 400);
    return inaccessible ? (
      <>
        <ErrorState
          title="Workspace not found"
          message="This workspace doesn't exist or you don't have access to it."
        />
        <Button asChild colorPalette="brand" variant="outline" display="flex" mx="auto" w="fit-content">
          <RouterLink to="/workspaces">View your workspaces</RouterLink>
        </Button>
      </>
    ) : (
      <ErrorState message={workspace.error.message} onRetry={() => void workspace.refetch()} />
    );
  }

  return (
    <CurrentWorkspaceContext value={workspace.data}>
      <Outlet />
    </CurrentWorkspaceContext>
  );
}
