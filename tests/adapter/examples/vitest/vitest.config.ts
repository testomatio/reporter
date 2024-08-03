// @ts-ignore
import { defineConfig } from 'vitest/config';
// @ts-ignore
import TestomatioReporter from '../../../../lib/adapter/vitest.js';

export default defineConfig({
  test: {
    // @ts-ignore - TODO: fix type
    reporters: ['verbose', new TestomatioReporter()],
    watch: false,
  },
});
