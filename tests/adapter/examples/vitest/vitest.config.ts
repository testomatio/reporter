import { defineConfig } from 'vitest/config';
// import { TestomatioReporter } from './reporter.ts'
// import { VitestReporter } from './node_modules/@testomatio/reporter/lib/adapter/vitest.js';
import TestomatioReporter from '../../../../lib/adapter/vitest.js';

export default defineConfig({
  test: {
    // reporters: ['verbose'],
    // reporters: ['verbose', new VitestReporter()],

    // both work
    // reporters: ['verbose', './node_modules/@testomatio/reporter/lib/adapter/vitest-common.js'],
    reporters: ['verbose', new TestomatioReporter()],
    watch: false,
  },
})
