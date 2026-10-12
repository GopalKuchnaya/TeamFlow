import { Button, Card, DataList, Field, Heading, Input, NativeSelect, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { notifyError, notifySuccess } from '@/components/feedback/notify';
import { PageHeader } from '@/components/page-header';
import { useCurrentUser } from '@/features/auth/api';
import { useMembers } from '@/features/members/api';
import type { Workspace } from '@/types/api';
import { useDeleteWorkspace, useLeaveWorkspace, useTransferOwnership, useUpdateWorkspace } from '../api';
import { RoleBadge } from '../components/role-badge';
import { WorkspaceForm } from '../components/workspace-form';
import { useCurrentWorkspace } from '../current-workspace';
import { ROLE_LABELS, permissions } from '../permissions';

function GeneralSettings({ workspace }: { workspace: Workspace }) {
  const update = useUpdateWorkspace(workspace.id);
  return (
    <Card.Root>
      <Card.Header>
        <Heading as="h2" size="md">
          General
        </Heading>
      </Card.Header>
      <Card.Body>
        <WorkspaceForm
          key={workspace.updatedAt}
          defaultValues={{ name: workspace.name, description: workspace.description }}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          resetOnSuccess
          onSubmit={async (values) => {
            await update.mutateAsync(values);
            notifySuccess('Workspace updated');
          }}
        />
      </Card.Body>
    </Card.Root>
  );
}

function WorkspaceDetails({ workspace }: { workspace: Workspace }) {
  return (
    <Card.Root>
      <Card.Header>
        <Heading as="h2" size="md">
          Details
        </Heading>
      </Card.Header>
      <Card.Body>
        <DataList.Root orientation="horizontal">
          <DataList.Item>
            <DataList.ItemLabel>Name</DataList.ItemLabel>
            <DataList.ItemValue>{workspace.name}</DataList.ItemValue>
          </DataList.Item>
          <DataList.Item>
            <DataList.ItemLabel>Description</DataList.ItemLabel>
            <DataList.ItemValue>{workspace.description || '—'}</DataList.ItemValue>
          </DataList.Item>
          <DataList.Item>
            <DataList.ItemLabel>Your role</DataList.ItemLabel>
            <DataList.ItemValue>
              <RoleBadge role={workspace.role} />
            </DataList.ItemValue>
          </DataList.Item>
        </DataList.Root>
        <Text mt="4" fontSize="sm" color="fg.muted">
          Only the workspace owner can change these settings.
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

function TransferOwnership({ workspace }: { workspace: Workspace }) {
  // Candidates are non-owner members; the API caps a page at 100.
  const members = useMembers(workspace.id, { page: 1, limit: 100 });
  const transfer = useTransferOwnership(workspace.id);
  const [targetId, setTargetId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const candidates = members.data?.items.filter((member) => member.role !== 'owner') ?? [];
  const target = candidates.find((member) => member.userId === targetId);

  return (
    <Card.Root>
      <Card.Header>
        <Heading as="h2" size="md">
          Transfer ownership
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          Make another member the owner. You will become an admin.
        </Text>
      </Card.Header>
      <Card.Body>
        {members.isError ? (
          <Text color="fg.error">{members.error.message}</Text>
        ) : candidates.length === 0 && !members.isPending ? (
          <Text color="fg.muted" fontSize="sm">
            Invite someone to the workspace before transferring ownership.
          </Text>
        ) : (
          <Stack direction={{ base: 'column', sm: 'row' }} gap="3" align={{ sm: 'flex-end' }}>
            <Field.Root flex="1">
              <Field.Label>New owner</Field.Label>
              <NativeSelect.Root disabled={members.isPending}>
                <NativeSelect.Field value={targetId} onChange={(event) => { setTargetId(event.currentTarget.value); }}>
                  <option value="">Select a member</option>
                  {candidates.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name} ({ROLE_LABELS[member.role]})
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button variant="outline" colorPalette="red" disabled={!target} onClick={() => { setConfirming(true); }}>
              Transfer
            </Button>
          </Stack>
        )}
      </Card.Body>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Transfer ownership?"
        description={`${target?.name ?? 'This member'} will become the owner of ${workspace.name}. You will become an admin and lose owner-only permissions.`}
        confirmLabel="Transfer ownership"
        isPending={transfer.isPending}
        onConfirm={() => {
          if (!target) return;
          transfer.mutate(target.userId, {
            onSuccess: () => {
              notifySuccess(`${target.name} is now the owner`);
              setTargetId('');
            },
            onError: (error) => { notifyError('Could not transfer ownership', error); },
            onSettled: () => { setConfirming(false); },
          });
        }}
      />
    </Card.Root>
  );
}

function DeleteWorkspace({ workspace }: { workspace: Workspace }) {
  const remove = useDeleteWorkspace(workspace.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  return (
    <Card.Root borderColor="red.200">
      <Card.Header>
        <Heading as="h2" size="md" color="fg.error">
          Delete workspace
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          Permanently delete this workspace, its memberships, and pending invitations. This cannot be undone.
        </Text>
      </Card.Header>
      <Card.Body>
        <Button colorPalette="red" alignSelf="flex-start" onClick={() => { setOpen(true); }}>
          Delete workspace
        </Button>
      </Card.Body>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmation('');
        }}
        title={`Delete ${workspace.name}?`}
        description="Everyone will lose access immediately. This cannot be undone."
        confirmLabel="Delete permanently"
        isPending={remove.isPending}
        confirmDisabled={confirmation !== workspace.name}
        onConfirm={() => { remove.mutate(undefined, {
            onSuccess: () => {
              notifySuccess(`${workspace.name} was deleted`);
              void navigate('/workspaces', { replace: true });
            },
            onError: (error) => { notifyError('Could not delete workspace', error); },
          }); }
        }
      >
        <Field.Root>
          <Field.Label>
            Type <strong>{workspace.name}</strong> to confirm
          </Field.Label>
          <Input value={confirmation} onChange={(event) => { setConfirmation(event.currentTarget.value); }} autoComplete="off" />
        </Field.Root>
      </ConfirmDialog>
    </Card.Root>
  );
}

function LeaveWorkspace({ workspace }: { workspace: Workspace }) {
  const user = useCurrentUser();
  const leave = useLeaveWorkspace(workspace.id, user.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <Card.Root>
      <Card.Header>
        <Heading as="h2" size="md">
          Leave workspace
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          You will lose access until someone invites you again.
        </Text>
      </Card.Header>
      <Card.Body>
        <Button variant="outline" colorPalette="red" alignSelf="flex-start" onClick={() => { setOpen(true); }}>
          Leave workspace
        </Button>
      </Card.Body>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Leave ${workspace.name}?`}
        description="You will immediately lose access to this workspace."
        confirmLabel="Leave workspace"
        isPending={leave.isPending}
        onConfirm={() => { leave.mutate(undefined, {
            onSuccess: () => {
              notifySuccess(`You left ${workspace.name}`);
              void navigate('/workspaces', { replace: true });
            },
            onError: (error) => { notifyError('Could not leave workspace', error); },
          }); }
        }
      />
    </Card.Root>
  );
}

export function WorkspaceSettingsPage() {
  const workspace = useCurrentWorkspace();
  const isOwner = permissions.updateWorkspace(workspace.role);

  return (
    <>
      <PageHeader title="Workspace settings" description={workspace.name} />
      <Stack gap="6" maxW="3xl">
        {isOwner ? <GeneralSettings workspace={workspace} /> : <WorkspaceDetails workspace={workspace} />}
        {permissions.transferOwnership(workspace.role) ? <TransferOwnership workspace={workspace} /> : null}
        {permissions.leave(workspace.role) ? <LeaveWorkspace workspace={workspace} /> : null}
        {permissions.deleteWorkspace(workspace.role) ? <DeleteWorkspace workspace={workspace} /> : null}
      </Stack>
    </>
  );
}
