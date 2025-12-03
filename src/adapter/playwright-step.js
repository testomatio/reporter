import { dataStorage } from '../data-storage.js';

let currentTestStep = null;
let currentTestContext = null;

/**
 * Sets the global test step function from testInfo.step
 * This should be called in each test that uses step() function
 * @param {Function} testStepFunction - The test.step function from Playwright
 */
export function setTestStep(testStepFunction) {
  currentTestStep = testStepFunction;
}

/**
 * Sets the current test context for logging
 * @param {object} testInfo - Playwright testInfo object
 */
export function setTestContext(testInfo) {
  currentTestContext = testInfo;
}

/**
 * Clears the current test step function and context
 */
export function clearTestStep() {
  currentTestStep = null;
  currentTestContext = null;
}

/**
 * Creates a step using Playwright's test.step function
 * @param {string} title - Step title
 * @param {Function} fn - Optional function to execute within the step
 * @returns {Promise<*>} Result of the function execution
 */
export async function step(title, fn) {
  if (!currentTestStep) {
    throw new Error('Step function requires test.step to be set. Call setTestStep(test.step) in your test before using step().\n\nExample:\nimport { setTestStep, step } from "@testomatio/reporter/playwright/step.js";\n\ntest("my test", async ({}, testInfo) => {\n  setTestStep(testInfo.step);\n  step("My step"); // Now works!\n});');
  }

  // If function provided, use it directly
  if (typeof fn === 'function') {
    return currentTestStep(title, fn);
  }

  // If no function, create a step that just logs
  return currentTestStep(title, async () => {
    // Log the step to data storage if we have context
    if (currentTestContext) {
      const fullTestTitle = getTestContextName(currentTestContext);
      dataStorage.setContext(fullTestTitle);

      // Add step log entry
      const stepLog = `> ${title}`;
      dataStorage.putData('log', stepLog);
    }
  });
}

/**
 * Get test context name
 * @param {object} testInfo - Playwright testInfo object
 * @returns {string}
 */
function getTestContextName(testInfo) {
  return `${testInfo._requireFile || ''}_${testInfo.title}`;
}

/**
 * Legacy step function for backward compatibility
 * Just logs without creating a Playwright step
 * @param {string} title - Step title
 */
export function logStep(title) {
  if (currentTestContext) {
    const fullTestTitle = getTestContextName(currentTestContext);
    dataStorage.setContext(fullTestTitle);

    const stepLog = `> ${title}`;
    dataStorage.putData('log', stepLog);
  }
}

// Export default for convenience
export default step;

// Legacy exports for backward compatibility (deprecated)
export function setCurrentTest(testInfo) {
  console.warn('setCurrentTest is deprecated. Use setTestContext instead.');
  setTestContext(testInfo);
}

export function clearCurrentTest() {
  console.warn('clearCurrentTest is deprecated. Use clearTestStep instead.');
  clearTestStep();
}