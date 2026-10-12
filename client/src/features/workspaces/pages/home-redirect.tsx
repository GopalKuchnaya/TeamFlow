import { Navigate } from 'react-router';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { useCurrentUser } from '@/features/auth/api';
import { useWorkspaces } from '../api';
import { recallWorkspace } from '../current-workspace';

/** `/` → the last workspace used in this browser, the most recent one, or the selection page. */
export function HomeRedirect() {
  const user = useCurrentUser();
  const workspaces = useWorkspaces();

  if (workspaces.isPending) return <LoadingState label="Loading your workspaces…" />;
  if (workspaces.isError) {
    return <ErrorState message={workspaces.error.message} onRetry={() => void workspaces.refetch()} />;
  }
  const items = workspaces.data.items;
  const remembered = recallWorkspace(user.id);
  const target = items.find((workspace) => workspace.id === remembered) ?? items[0];
  return <Navigate to={target ? `/w/${target.id}` : '/workspaces'} replace />;
}
