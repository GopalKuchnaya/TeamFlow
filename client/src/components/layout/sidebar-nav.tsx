import { Icon, Link, Stack } from '@chakra-ui/react';
import { NavLink } from 'react-router';
import { NAV_ITEMS } from './nav-items';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation">
      <Stack as="ul" gap="1" listStyleType="none">
        {NAV_ITEMS.map((item) => (
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
    </nav>
  );
}
