import { Box, Card, Heading, HStack, Icon, Link, SimpleGrid, Skeleton, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuMailPlus, LuSettings, LuUsers } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router';
import { useInvitations, useMembers } from '@/features/members/api';
import { useCurrentWorkspace } from '../current-workspace';
import { permissions } from '../permissions';
import { RoleBadge } from '../components/role-badge';

function StatCard({ icon, label, value, to, linkLabel }: {
  icon: typeof LuUsers;
  label: string;
  value: ReactNode;
  to: string;
  linkLabel: string;
}) {
  return (
    <Card.Root>
      <Card.Body gap="3">
        <HStack justify="space-between">
          <Text color="fg.muted" fontWeight="medium">
            {label}
          </Text>
          <Icon as={icon} color="brand.solid" boxSize="5" />
        </HStack>
        {/* A div, not a <p>: the value may be a skeleton or badge element. */}
        <Box fontSize="3xl" fontWeight="bold" lineHeight="1">
          {value}
        </Box>
        <Link asChild color="brand.fg" fontSize="sm" fontWeight="medium">
          <RouterLink to={to}>{linkLabel}</RouterLink>
        </Link>
      </Card.Body>
    </Card.Root>
  );
}

export function WorkspaceOverviewPage() {
  const workspace = useCurrentWorkspace();
  const canManageInvites = permissions.manageInvitations(workspace.role);
  const members = useMembers(workspace.id, { page: 1, limit: 1 });
  const invitations = useInvitations(workspace.id, 1, canManageInvites);
  const count = (query: { data?: { total: number }; isError: boolean }) =>
    query.data ? query.data.total : query.isError ? '—' : <Skeleton h="8" w="10" />;

  return (
    <>
      <Stack gap="2" mb="8">
        <HStack gap="3" wrap="wrap">
          <Heading as="h1" size="2xl" letterSpacing="tight">
            {workspace.name}
          </Heading>
          <RoleBadge role={workspace.role} />
        </HStack>
        <Text color="fg.muted">{workspace.description || 'No description yet.'}</Text>
      </Stack>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
        <StatCard
          icon={LuUsers}
          label="Members"
          value={count(members)}
          to={`/w/${workspace.id}/members`}
          linkLabel="View members"
        />
        {canManageInvites ? (
          <StatCard
            icon={LuMailPlus}
            label="Pending invitations"
            value={count(invitations)}
            to={`/w/${workspace.id}/members`}
            linkLabel="Invite people"
          />
        ) : null}
        <StatCard
          icon={LuSettings}
          label="Your role"
          value={<RoleBadge role={workspace.role} />}
          to={`/w/${workspace.id}/settings`}
          linkLabel="Workspace settings"
        />
      </SimpleGrid>
    </>
  );
}
