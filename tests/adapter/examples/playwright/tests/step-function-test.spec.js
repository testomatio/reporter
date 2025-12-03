import { expect, test } from '@playwright/test';
import { setTestStep, clearTestStep, step } from '../../../../../src/adapter/playwright-step.js';
import { log as reporterLog } from '@testomatio/reporter';

test.describe('Testomat.io step function - FIXED', () => {
  test('step function should work with Playwright', async ({}, testInfo) => {
    setTestStep(testInfo.step);

    try {
      step('Step 1: Using Testomat step');

      reporterLog('Log 1: Using Testomat log');

      await test.step('Step 2: Using Playwright step', async () => {
        reporterLog('This also works');
      });

      await step('Step 3: Testomat step with function', async () => {
        expect(true).toBe(true);
        reporterLog('Inside Testomat step function');
      });

      expect(true).toBe(true);

    } finally {
      clearTestStep();
    }
  });

  test('multiple steps should work', async ({}, testInfo) => {
    setTestStep(testInfo.step);

    try {
      step('Setup step');

      await step('Action step', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log('Action completed');
      });

      step('Cleanup step');

      expect(true).toBe(true);

    } finally {
      clearTestStep();
    }
  });

  test('steps should handle edge cases', async ({}, testInfo) => {
    setTestStep(testInfo.step);

    try {
      step('');

      step('Step with special chars: @#$%^&*()');

      step('This is a very long step message that might be truncated in some systems and contains a lot of text to test edge cases');

      expect(true).toBe(true);

    } finally {
      const { clearTestStep } = await import('../../../src/adapter/playwright-step.js');
      clearTestStep();
    }
  });
});