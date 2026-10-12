import { Avatar, Box, Button, HStack, Menu, Portal, Text } from '@chakra-ui/react';
import { LuChevronDown, LuLogOut, LuUserCog } from 'react-icons/lu';
import { useNavigate } from 'react-router';
import { toaster } from '@/components/feedback/toaster';
import { useCurrentUser, useLogout } from '@/features/auth/api';

export function UserMenu() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => toaster.create({ type: 'info', title: 'You have been signed out.' }),
      onError: () =>
        toaster.create({
          type: 'warning',
          title: 'Signed out on this device',
          description: 'We could not reach the server to end the session remotely.',
        }),
      onSettled: () => void navigate('/login', { replace: true }),
    });
  };

  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button variant="ghost" px="2" aria-label={`Account menu for ${user.name}`}>
          <HStack gap="2">
            <Avatar.Root size="xs" colorPalette="brand">
              <Avatar.Fallback name={user.name} />
              {user.avatarUrl ? <Avatar.Image src={user.avatarUrl} alt="" /> : null}
            </Avatar.Root>
            <Text display={{ base: 'none', sm: 'block' }} fontWeight="medium" maxW="40" truncate>
              {user.name}
            </Text>
            <LuChevronDown aria-hidden="true" />
          </HStack>
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="56">
            <Box px="2" py="1.5">
              <Text fontWeight="medium" truncate>
                {user.name}
              </Text>
              <Text fontSize="sm" color="fg.muted" truncate>
                {user.email}
              </Text>
            </Box>
            <Menu.Separator />
            <Menu.Item value="account" onClick={() => void navigate('/account')}>
              <LuUserCog />
              Account settings
            </Menu.Item>
            <Menu.Item value="logout" onClick={handleLogout} disabled={logout.isPending}>
              <LuLogOut />
              Sign out
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
