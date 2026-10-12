import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * TeamFlow design tokens: navy text, neutral surfaces, restrained indigo/violet accent.
 * Use `colorPalette="brand"` on components for the primary accent.
 */
const config = defineConfig({
  globalCss: {
    'html, body': {
      bg: 'bg.canvas',
      color: 'fg',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
        body: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
      },
      colors: {
        brand: {
          50: { value: '#eef2ff' },
          100: { value: '#e0e7ff' },
          200: { value: '#c7d2fe' },
          300: { value: '#a5b4fc' },
          400: { value: '#818cf8' },
          500: { value: '#6366f1' },
          600: { value: '#4f46e5' },
          700: { value: '#4338ca' },
          800: { value: '#3730a3' },
          900: { value: '#312e81' },
          950: { value: '#1e1b4b' },
        },
        navy: {
          600: { value: '#334155' },
          700: { value: '#1e293b' },
          800: { value: '#172033' },
          900: { value: '#0f172a' },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: '{colors.brand.600}' },
          contrast: { value: 'white' },
          fg: { value: '{colors.brand.700}' },
          muted: { value: '{colors.brand.100}' },
          subtle: { value: '{colors.brand.50}' },
          emphasized: { value: '{colors.brand.200}' },
          focusRing: { value: '{colors.brand.500}' },
        },
        fg: {
          DEFAULT: { value: '{colors.navy.900}' },
          muted: { value: '{colors.navy.600}' },
        },
        bg: {
          canvas: { value: '#f8fafc' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
