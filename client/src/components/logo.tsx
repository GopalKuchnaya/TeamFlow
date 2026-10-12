import { HStack, Text, chakra } from '@chakra-ui/react';

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 9 : 7;
  return (
    <HStack gap="2">
      <chakra.svg viewBox="0 0 32 32" boxSize={box} aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--chakra-colors-brand-600)" />
        <path d="M9 10h14M9 16h9M9 22h5" stroke="white" strokeWidth="3" strokeLinecap="round" />
      </chakra.svg>
      <Text fontWeight="bold" fontSize={size === 'lg' ? '2xl' : 'lg'} letterSpacing="tight" color="fg">
        TeamFlow
      </Text>
    </HStack>
  );
}
