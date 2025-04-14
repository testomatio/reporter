import { defineConfig } from 'vitest/config';
import TestomatioReporter from '../../../../lib/adapter/vitest.js';

export default defineConfig({
  test: {
    reporters: ['verbose', new TestomatioReporter()],
    watch: false,
  },
});
