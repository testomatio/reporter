// @ts-ignore
import { defineConfig } from 'vitest/config';
// @ts-ignore
import TestomatioReporter from '../../../../lib/adapter/vitest.js';
export default defineConfig({
    test: {
        reporters: ['verbose', new TestomatioReporter()],
        watch: false,
    },
});
