import { Avatar, Button, Card, DataList, HStack, Heading, Stack, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { PageHeader } from '@/components/page-header';
import { useLogout, useMe } from '@/features/auth/api';

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

export function AccountPage() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Account settings" description="Your profile and session." />
      {me.isPending ? (
        <LoadingState label="Loading your profile…" />
      ) : me.isError ? (
        <ErrorState message={me.error.message} onRetry={() => void me.refetch()} />
      ) : (
        <Stack gap="6" maxW="2xl">
          <Card.Root>
            <Card.Header>
              <HStack gap="4">
                <Avatar.Root size="lg" colorPalette="brand">
                  <Avatar.Fallback name={me.data.name} />
                  {me.data.avatarUrl ? <Avatar.Image src={me.data.avatarUrl} alt="" /> : null}
                </Avatar.Root>
                <Stack gap="0" minW="0">
                  <Heading as="h2" size="lg" truncate>
                    {me.data.name}
                  </Heading>
                  <Text color="fg.muted" truncate>
                    {me.data.email}
                  </Text>
                </Stack>
              </HStack>
            </Card.Header>
            <Card.Body>
              <DataList.Root orientation="horizontal">
                <DataList.Item>
                  <DataList.ItemLabel>Name</DataList.ItemLabel>
                  <DataList.ItemValue>{me.data.name}</DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Email</DataList.ItemLabel>
                  <DataList.ItemValue wordBreak="break-all">{me.data.email}</DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Member since</DataList.ItemLabel>
                  <DataList.ItemValue>{dateFormatter.format(new Date(me.data.createdAt))}</DataList.ItemValue>
                </DataList.Item>
              </DataList.Root>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Stack gap="3" align="flex-start">
                <Heading as="h2" size="md">
                  Session
                </Heading>
                <Text color="fg.muted">Sign out of TeamFlow on this device. Your session will be revoked on the server.</Text>
                <Button
                  variant="outline"
                  colorPalette="red"
                  loading={logout.isPending}
                  onClick={() => { logout.mutate(undefined, { onSettled: () => void navigate('/login', { replace: true }) }); }}
                >
                  Sign out
                </Button>
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>
      )}
    </>
  );
}
