import { Card, Heading, Icon, Link, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { LuShieldCheck, LuUserCog } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { useCurrentUser } from '@/features/auth/api';

export function HomePage() {
  const user = useCurrentUser();
  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="Your TeamFlow account is set up and secure." />
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
        <Card.Root>
          <Card.Body>
            <Stack gap="3">
              <Icon as={LuShieldCheck} boxSize="6" color="brand.solid" />
              <Heading as="h2" size="md">
                Signed in securely
              </Heading>
              <Text color="fg.muted">
                Your session renews automatically and survives page reloads. Signing out ends it on the server.
              </Text>
            </Stack>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <Stack gap="3">
              <Icon as={LuUserCog} boxSize="6" color="brand.solid" />
              <Heading as="h2" size="md">
                Your profile
              </Heading>
              <Text color="fg.muted">Review the details associated with your account.</Text>
              <Link asChild color="brand.fg" fontWeight="medium" alignSelf="flex-start">
                <RouterLink to="/account">Open account settings</RouterLink>
              </Link>
            </Stack>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>
    </>
  );
}
