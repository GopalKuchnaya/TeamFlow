import type { IconType } from 'react-icons';
import { LuHouse, LuUserCog } from 'react-icons/lu';

export interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
}

// Workspace, project, and notification entries are added as their phases ship.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', icon: LuHouse, end: true },
  { label: 'Account settings', to: '/account', icon: LuUserCog },
];
