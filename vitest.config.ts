import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./src/test/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup-tests.ts'],
    coverage: {
      reporter: ['json-summary'],
    },
  },
});