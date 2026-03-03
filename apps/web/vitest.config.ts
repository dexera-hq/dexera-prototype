import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': appRoot,
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    globals: true,
  },
});
