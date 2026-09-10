import { PlaywrightTestConfig } from '@playwright/test';

// test fails on CI with this type if NODE=v23:
// SyntaxError: The requested module '@playwright/test' does not provide an export named 'PlaywrightTestConfig'
// Reference: https://playwright.dev/docs/test-configuration
const config: PlaywrightTestConfig = {
  testMatch: '/tests/*.spec.js',
  reporter: [
    ['list'],
    // ['@testomatio/reporter/lib/adapter/playwright.js', {
    [
      '../../../../lib/adapter/playwright.js',
      {
        apiKey: process.env.TESTOMATIO,
      },
    ],
  ],
};
export default config;
