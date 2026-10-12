import { Box, Button, HStack, Menu, Portal, Text } from '@chakra-ui/react';
import { LuCheck, LuChevronsUpDown, LuLayoutGrid, LuPlus } from 'react-icons/lu';
import { useNavigate } from 'react-router';
import { useWorkspaces } from '@/features/workspaces/api';
import { useActiveWorkspaceId } from './use-active-workspace';

export function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const workspaces = useWorkspaces();
  const activeId = useActiveWorkspaceId();
  const navigate = useNavigate();
  const active = workspaces.data?.items.find((workspace) => workspace.id === activeId);

  const go = (to: string) => {
    onNavigate?.();
    void navigate(to);
  };

  return (
    <Menu.Root positioning={{ placement: 'bottom-start', sameWidth: true }}>
      <Menu.Trigger asChild>
        <Button variant="outline" w="full" justifyContent="space-between" aria-label="Switch workspace" bg="bg">
          <Box minW="0" textAlign="start">
            <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
              Workspace
            </Text>
            <Text fontWeight="semibold" truncate>
              {active?.name ?? 'Select a workspace'}
            </Text>
          </Box>
          <LuChevronsUpDown aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content maxH="80" overflowY="auto">
            {workspaces.isError ? (
              <Text px="2" py="1.5" fontSize="sm" color="fg.error">
                Could not load workspaces
              </Text>
            ) : null}
            {workspaces.data?.items.map((workspace) => (
              <Menu.Item key={workspace.id} value={workspace.id} onClick={() => { go(`/w/${workspace.id}`); }}>
                <HStack justify="space-between" w="full" gap="3">
                  <Text truncate>{workspace.name}</Text>
                  {workspace.id === activeId ? <LuCheck aria-label="Current workspace" /> : null}
                </HStack>
              </Menu.Item>
            ))}
            <Menu.Separator />
            <Menu.Item value="all" onClick={() => { go('/workspaces'); }}>
              <LuLayoutGrid /> All workspaces
            </Menu.Item>
            <Menu.Item value="create" onClick={() => { go('/workspaces'); }}>
              <LuPlus /> Create workspace
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
