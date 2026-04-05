import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/utilities/index.ts'],
      reporter: ['text', 'json-summary', 'json'],
    },
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
});
