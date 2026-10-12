import { Badge } from '@chakra-ui/react';
import type { WorkspaceRole } from '@/types/api';
import { ROLE_COLORS, ROLE_LABELS } from '../permissions';

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <Badge colorPalette={ROLE_COLORS[role]} variant="subtle">
      {ROLE_LABELS[role]}
    </Badge>
  );
}
