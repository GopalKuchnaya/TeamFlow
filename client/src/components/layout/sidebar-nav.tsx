import { Icon, Link, Stack, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router';
import { getNavSections } from './nav-items';
import { useActiveWorkspaceId } from './use-active-workspace';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const sections = getNavSections(useActiveWorkspaceId());
  return (
    <nav aria-label="Main navigation">
      <Stack gap="5">
        {sections.map((section) => (
          <Stack key={section.label} gap="1">
            <Text px="3" fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
              {section.label}
            </Text>
            <Stack as="ul" gap="1" listStyleType="none">
              {section.items.map((item) => (
                <li key={item.to}>
                  <Link
                    asChild
                    display="flex"
                    alignItems="center"
                    gap="3"
                    px="3"
                    py="2"
                    borderRadius="lg"
                    fontWeight="medium"
                    color="fg.muted"
                    textDecoration="none"
                    _hover={{ bg: 'bg.muted', color: 'fg', textDecoration: 'none' }}
                    _currentPage={{ bg: 'brand.subtle', color: 'brand.fg' }}
                    focusRingColor="brand.focusRing"
                  >
                    <NavLink to={item.to} end={item.end ?? false} onClick={onNavigate}>
                      <Icon as={item.icon} boxSize="4" />
                      {item.label}
                    </NavLink>
                  </Link>
                </li>
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </nav>
  );
}
