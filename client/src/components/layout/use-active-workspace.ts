import { useMatch } from 'react-router';

/** The workspace id in the current URL (`/w/:workspaceId/...`), if any. */
export function useActiveWorkspaceId(): string | undefined {
  const match = useMatch('/w/:workspaceId/*');
  return match?.params.workspaceId;
}
