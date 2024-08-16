// @ts-ignore
import { defineConfig } from 'vitest/config';
// @ts-ignore
import TestomatioReporter from '../../../../lib/adapter/vitest.js';

export default defineConfig({
  test: {
    // @ts-ignore
    reporters: ['basic', new TestomatioReporter()],
    watch: false,
    include: ['**/vitest/*.test.ts', '*.test.ts'],
    // include: ['./**/*.test.ts'],
  },
});
