import { PlaywrightTestConfig } from '@playwright/test';

// Reference: https://playwright.dev/docs/test-configuration
const config: PlaywrightTestConfig = {
  testMatch: '/tests/*.spec.ts',
  reporter: [
    ['list'],
    // ['@testomatio/reporter/lib/adapter/playwright.js', {
    ['../../../../lib/adapter/playwright.js', {
      apiKey: process.env.TESTOMATIO,
    }]
  ]
};
export default config;
