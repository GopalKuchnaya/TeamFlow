import { Box, Card, Center, Heading, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <Center minH="100dvh" px="4" py="10" bg="bg.canvas">
      <Stack gap="6" w="full" maxW="md">
        <Center>
          <Logo size="lg" />
        </Center>
        <Card.Root as="main" variant="elevated" borderRadius="2xl">
          <Card.Body p={{ base: '6', md: '8' }}>
            <Stack gap="6">
              <Stack gap="1">
                <Heading as="h1" size="xl">
                  {title}
                </Heading>
                <Text color="fg.muted">{subtitle}</Text>
              </Stack>
              {children}
            </Stack>
          </Card.Body>
        </Card.Root>
        <Box textAlign="center" color="fg.muted" fontSize="sm">
          {footer}
        </Box>
      </Stack>
    </Center>
  );
}
