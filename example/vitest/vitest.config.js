import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use the testomatio reporter
    reporters: ['default', ['../../src/adapter/vitest.js', {}]],

    // Run tests sequentially for predictable results
    pool: 'forks',
    forks: {
      singleFork: true,
    },

    // Disable watch mode by default
    watch: false,

    // Simple globals config
    globals: false,

    // Environment
    environment: 'node',
  },
});
