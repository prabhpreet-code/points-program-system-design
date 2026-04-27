import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
  },
  // Pin an empty PostCSS config so vitest doesn't walk up the tree and pick up
  // stray configs outside the monorepo.
  css: {
    postcss: { plugins: [] },
  },
});
