import { Card, Heading, Stack, Text } from '@chakra-ui/react';
import { PageHeader } from '@/components/page-header';
import { useCurrentWorkspace } from '@/features/workspaces/current-workspace';
import { permissions } from '@/features/workspaces/permissions';
import { InvitationList } from './components/invitation-list';
import { InviteForm } from './components/invite-form';
import { MemberList } from './components/member-list';

export function MembersPage() {
  const workspace = useCurrentWorkspace();
  const canManageInvites = permissions.manageInvitations(workspace.role);

  return (
    <>
      <PageHeader title="Members" description={`People with access to ${workspace.name}.`} />
      <Stack gap="6">
        {canManageInvites ? (
          <Card.Root>
            <Card.Header>
              <Heading as="h2" size="md">
                Invite people
              </Heading>
              <Text color="fg.muted" fontSize="sm">
                {workspace.role === 'owner'
                  ? 'Invite teammates as members or admins.'
                  : 'As an admin you can invite members. Only the owner can invite admins.'}
              </Text>
            </Card.Header>
            <Card.Body gap="6">
              <InviteForm workspaceId={workspace.id} actorRole={workspace.role} />
              <Stack gap="3">
                <Heading as="h3" size="sm">
                  Pending invitations
                </Heading>
                <InvitationList workspaceId={workspace.id} />
              </Stack>
            </Card.Body>
          </Card.Root>
        ) : null}

        <Card.Root>
          <Card.Header>
            <Heading as="h2" size="md">
              Workspace members
            </Heading>
          </Card.Header>
          <Card.Body>
            <MemberList workspace={workspace} />
          </Card.Body>
        </Card.Root>
      </Stack>
    </>
  );
}
