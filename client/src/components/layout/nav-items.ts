import type { IconType } from 'react-icons';
import { LuLayoutDashboard, LuLayoutGrid, LuSettings, LuUserCog, LuUsers } from 'react-icons/lu';

export interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Workspace-scoped entries appear once a workspace is selected; projects follow in Phase 3. */
export function getNavSections(workspaceId: string | undefined): NavSection[] {
  const sections: NavSection[] = [];
  if (workspaceId) {
    const base = `/w/${workspaceId}`;
    sections.push({
      label: 'Workspace',
      items: [
        { label: 'Overview', to: base, icon: LuLayoutDashboard, end: true },
        { label: 'Members', to: `${base}/members`, icon: LuUsers },
        { label: 'Settings', to: `${base}/settings`, icon: LuSettings },
      ],
    });
  }
  sections.push({
    label: 'General',
    items: [
      { label: 'All workspaces', to: '/workspaces', icon: LuLayoutGrid },
      { label: 'Account settings', to: '/account', icon: LuUserCog },
    ],
  });
  return sections;
}
