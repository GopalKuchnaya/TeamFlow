import { Box, CloseButton, Drawer, Flex, IconButton, Portal, chakra } from '@chakra-ui/react';
import { useState } from 'react';
import { LuMenu } from 'react-icons/lu';
import { Outlet } from 'react-router';
import { Logo } from '@/components/logo';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';
import { WorkspaceSwitcher } from './workspace-switcher';

const SIDEBAR_WIDTH = '64';

/** Authenticated layout: sidebar on desktop, drawer navigation on mobile. */
export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Flex minH="100dvh">
      <chakra.a
        href="#main-content"
        position="absolute"
        left="2"
        top="-20"
        zIndex="skipLink"
        bg="bg"
        px="3"
        py="2"
        borderRadius="md"
        boxShadow="md"
        _focus={{ top: '2' }}
      >
        Skip to content
      </chakra.a>

      <Box
        as="aside"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        w={SIDEBAR_WIDTH}
        flexShrink={0}
        borderRightWidth="1px"
        bg="bg"
        px="4"
        py="5"
        gap="6"
        position="sticky"
        top="0"
        h="100dvh"
      >
        <Box px="2">
          <Logo />
        </Box>
        <WorkspaceSwitcher />
        <SidebarNav />
      </Box>

      <Flex direction="column" flex="1" minW="0">
        <Flex
          as="header"
          align="center"
          justify="space-between"
          gap="3"
          h="16"
          px={{ base: '4', md: '6' }}
          borderBottomWidth="1px"
          bg="bg"
          position="sticky"
          top="0"
          zIndex="sticky"
        >
          <Flex align="center" gap="2">
            <IconButton
              display={{ base: 'inline-flex', lg: 'none' }}
              variant="ghost"
              aria-label="Open navigation"
              onClick={() => { setMobileNavOpen(true); }}
            >
              <LuMenu />
            </IconButton>
            <Box display={{ base: 'block', lg: 'none' }}>
              <Logo />
            </Box>
          </Flex>
          <UserMenu />
        </Flex>

        <Box as="main" id="main-content" tabIndex={-1} flex="1" px={{ base: '4', md: '8' }} py={{ base: '6', md: '8' }}>
          <Box maxW="6xl" mx="auto">
            <Outlet />
          </Box>
        </Box>
      </Flex>

      <Drawer.Root open={mobileNavOpen} onOpenChange={(details) => { setMobileNavOpen(details.open); }} placement="start">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content maxW="72">
              <Drawer.Header>
                <Drawer.Title>
                  <Logo />
                </Drawer.Title>
              </Drawer.Header>
              <Drawer.Body display="flex" flexDirection="column" gap="5">
                <WorkspaceSwitcher onNavigate={() => { setMobileNavOpen(false); }} />
                <SidebarNav onNavigate={() => { setMobileNavOpen(false); }} />
              </Drawer.Body>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" aria-label="Close navigation" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Flex>
  );
}
