import { Card, Heading, LinkBox, LinkOverlay, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { LuLayoutGrid } from 'react-icons/lu';
import { Link as RouterLink, useNavigate } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/states';
import { notifySuccess } from '@/components/feedback/notify';
import { PageHeader } from '@/components/page-header';
import { useCreateWorkspace, useWorkspaces } from '../api';
import { RoleBadge } from '../components/role-badge';
import { WorkspaceForm } from '../components/workspace-form';

/** Workspace selection: every workspace the user belongs to, plus creation. */
export function WorkspacesPage() {
  const workspaces = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Workspaces" description="Choose a workspace or create a new one for your team." />
      <Stack gap="8">
        {workspaces.isPending ? (
          <LoadingState label="Loading workspaces…" />
        ) : workspaces.isError ? (
          <ErrorState message={workspaces.error.message} onRetry={() => void workspaces.refetch()} />
        ) : workspaces.data.items.length === 0 ? (
          <EmptyState
            icon={<LuLayoutGrid />}
            title="No workspaces yet"
            description="Create your first workspace below, or ask a teammate to send you an invite link."
          />
        ) : (
          <SimpleGrid as="ul" columns={{ base: 1, md: 2, xl: 3 }} gap="4" listStyleType="none" aria-label="Your workspaces">
            {workspaces.data.items.map((workspace) => (
              <li key={workspace.id}>
                <LinkBox as={Card.Root} h="full" _hover={{ borderColor: 'brand.emphasized', shadow: 'sm' }}>
                  <Card.Body gap="2">
                    <Stack direction="row" justify="space-between" align="flex-start" gap="3">
                      <Heading as="h2" size="md" lineClamp={1}>
                        <LinkOverlay asChild>
                          <RouterLink to={`/w/${workspace.id}`}>{workspace.name}</RouterLink>
                        </LinkOverlay>
                      </Heading>
                      <RoleBadge role={workspace.role} />
                    </Stack>
                    <Text color="fg.muted" fontSize="sm" lineClamp={2}>
                      {workspace.description || 'No description'}
                    </Text>
                  </Card.Body>
                </LinkBox>
              </li>
            ))}
          </SimpleGrid>
        )}

        <Card.Root maxW="xl">
          <Card.Header>
            <Heading as="h2" size="md">
              Create a workspace
            </Heading>
          </Card.Header>
          <Card.Body>
            <WorkspaceForm
              submitLabel="Create workspace"
              pendingLabel="Creating…"
              onSubmit={async (values) => {
                const workspace = await createWorkspace.mutateAsync(values);
                notifySuccess(`Created ${workspace.name}`);
                await navigate(`/w/${workspace.id}`);
              }}
            />
          </Card.Body>
        </Card.Root>
      </Stack>
    </>
  );
}
