import { Alert, Button, Center, DataList, Link, Spinner, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { notifySuccess } from '@/components/feedback/notify';
import { ErrorState } from '@/components/feedback/states';
import { useLogout, useSession } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { FormAlert } from '@/features/auth/components/form-alert';
import { ROLE_LABELS } from '@/features/workspaces/permissions';
import { ApiError } from '@/lib/api-client';
import type { InvitationPreview } from '@/types/api';
import { useAcceptInvitation, useInvitationPreview } from './api';

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

function InvitationDetails({ invitation }: { invitation: InvitationPreview }) {
  return (
    <DataList.Root orientation="horizontal" size="sm">
      <DataList.Item>
        <DataList.ItemLabel>Workspace</DataList.ItemLabel>
        <DataList.ItemValue fontWeight="medium">{invitation.workspaceName}</DataList.ItemValue>
      </DataList.Item>
      <DataList.Item>
        <DataList.ItemLabel>Role</DataList.ItemLabel>
        <DataList.ItemValue>{ROLE_LABELS[invitation.role]}</DataList.ItemValue>
      </DataList.Item>
      <DataList.Item>
        <DataList.ItemLabel>Invited</DataList.ItemLabel>
        <DataList.ItemValue wordBreak="break-all">{invitation.email}</DataList.ItemValue>
      </DataList.Item>
      <DataList.Item>
        <DataList.ItemLabel>Expires</DataList.ItemLabel>
        <DataList.ItemValue>{dateFormatter.format(new Date(invitation.expiresAt))}</DataList.ItemValue>
      </DataList.Item>
    </DataList.Root>
  );
}

function InvitationActions({ token, invitation }: { token: string; invitation: InvitationPreview }) {
  const session = useSession();
  const logout = useLogout();
  const accept = useAcceptInvitation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const from = { from: `/invite/${token}` };

  if (session.isPending) {
    return (
      <Center py="4">
        <Spinner color="brand.solid" />
      </Center>
    );
  }

  if (!session.data) {
    return (
      <Stack gap="3">
        <Text color="fg.muted">
          Sign in or create an account with <strong>{invitation.email}</strong> to join.
        </Text>
        <Button asChild colorPalette="brand">
          <RouterLink to="/login" state={from}>
            Sign in to accept
          </RouterLink>
        </Button>
        <Button asChild variant="outline">
          <RouterLink to="/register" state={from}>
            Create an account
          </RouterLink>
        </Button>
      </Stack>
    );
  }

  if (session.data.email !== invitation.email) {
    return (
      <Stack gap="3">
        <Alert.Root status="warning" borderRadius="lg">
          <Alert.Indicator />
          <Alert.Description>
            You're signed in as <strong>{session.data.email}</strong>, but this invitation is for{' '}
            <strong>{invitation.email}</strong>.
          </Alert.Description>
        </Alert.Root>
        <Button variant="outline" loading={logout.isPending} onClick={() => { logout.mutate(); }}>
          Sign out and switch account
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="3">
      <FormAlert message={error} />
      <Button
        colorPalette="brand"
        size="lg"
        loading={accept.isPending}
        loadingText="Joining…"
        onClick={() => {
          setError(null);
          accept.mutate(token, {
            onSuccess: (workspace) => {
              notifySuccess(`Welcome to ${workspace.name}!`);
              void navigate(`/w/${workspace.id}`, { replace: true });
            },
            onError: (err) => { setError(err instanceof ApiError ? err.message : 'Could not accept the invitation.'); },
          });
        }}
      >
        Accept invitation
      </Button>
    </Stack>
  );
}

export function AcceptInvitationPage() {
  const { token = '' } = useParams();
  const preview = useInvitationPreview(token);

  const footer = (
    <Link asChild color="brand.fg" fontWeight="medium">
      <RouterLink to="/">Go to TeamFlow</RouterLink>
    </Link>
  );

  if (preview.isPending) {
    return (
      <AuthLayout title="Workspace invitation" subtitle="Checking your invitation…" footer={footer}>
        <Center py="4">
          <Spinner color="brand.solid" />
        </Center>
      </AuthLayout>
    );
  }

  if (preview.isError) {
    const notFound = preview.error instanceof ApiError && [400, 404].includes(preview.error.status);
    return (
      <AuthLayout title="Workspace invitation" subtitle="We couldn't open this invitation." footer={footer}>
        {notFound ? (
          <Text color="fg.muted">
            This invitation link is invalid or has been revoked. Ask the person who invited you for a new link.
          </Text>
        ) : (
          <ErrorState message={preview.error.message} onRetry={() => void preview.refetch()} />
        )}
      </AuthLayout>
    );
  }

  const invitation = preview.data;
  const subtitle = invitation.invitedByName
    ? `${invitation.invitedByName} invited you to join ${invitation.workspaceName}.`
    : `You've been invited to join ${invitation.workspaceName}.`;

  return (
    <AuthLayout title="Join a workspace" subtitle={subtitle} footer={footer}>
      <Stack gap="5">
        <InvitationDetails invitation={invitation} />
        {invitation.status === 'expired' ? (
          <Alert.Root status="warning" borderRadius="lg">
            <Alert.Indicator />
            <Alert.Description>This invitation has expired. Ask for a new link.</Alert.Description>
          </Alert.Root>
        ) : invitation.status === 'accepted' ? (
          <Alert.Root status="info" borderRadius="lg">
            <Alert.Indicator />
            <Alert.Description>This invitation has already been used.</Alert.Description>
          </Alert.Root>
        ) : (
          <InvitationActions token={token} invitation={invitation} />
        )}
      </Stack>
    </AuthLayout>
  );
}
