import { createContext, useContext } from 'react';
import type { Workspace } from '@/types/api';

/** Provided by `WorkspaceLayout` once the caller's membership has been confirmed by the API. */
export const CurrentWorkspaceContext = createContext<Workspace | null>(null);

export function useCurrentWorkspace(): Workspace {
  const workspace = useContext(CurrentWorkspaceContext);
  if (!workspace) throw new Error('useCurrentWorkspace must be used within WorkspaceLayout');
  return workspace;
}

// Remembering the last workspace is a per-browser convenience only, so storage failures
// (private mode, blocked storage) are ignored.
const storageKey = (userId: string) => `teamflow:lastWorkspace:${userId}`;

export function rememberWorkspace(userId: string, workspaceId: string): void {
  try {
    localStorage.setItem(storageKey(userId), workspaceId);
  } catch {
    /* ignore */
  }
}

export function recallWorkspace(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}
