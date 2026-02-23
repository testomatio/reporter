/**
 * WebdriverIO Hooks Enhancer
 *
 * Tracks and reports all tests as failed when beforeEach hook fails
 */

import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as fs from 'fs';

class WebdriverHooksEnhancer {
  constructor() {
    this.hookFailures = {};
  }

  /**
   * Track hook failures from onHookEnd
   */
  trackHookFailure(hook) {
    const isBeforeEach = hook.title && hook.title.includes('before each');

    if (isBeforeEach && hook.errors && hook.errors.length > 0) {
      if (!this.hookFailures[hook.parent]) {
        this.hookFailures[hook.parent] = {
          error: hook.errors[0],
          suiteTitle: hook.parent,
        };
      }
    }
  }

  /**
   * Handle suite end and report failed tests
   */
  async handleSuiteEnd(suiteOrScenario, client, getTestomatIdFromTestTitle) {
    if (suiteOrScenario.type !== 'scenario') {
      if (this.hookFailures[suiteOrScenario.fullTitle]) {
        const { error, suiteTitle } = this.hookFailures[suiteOrScenario.fullTitle];

        const allTestTitles = this.extractTestsFromSpecFile(suiteOrScenario.file);

        const allTestsCount = allTestTitles.length;
        const ranTestsCount = (suiteOrScenario.tests || []).length;

        // Report tests that didn't run due to hook failure
        for (let i = ranTestsCount; i < allTestsCount; i++) {
          const testTitle = allTestTitles[i];
          await client.addTestRun('failed', {
            error,
            suite_title: suiteTitle,
            title: testTitle,
            test_id: getTestomatIdFromTestTitle(testTitle),
            time: 0,
          });
        }

        if (suiteOrScenario.tests) {
          for (let i = 0; i < suiteOrScenario.tests.length; i++) {
            const test = suiteOrScenario.tests[i];
            if (!test.state || test.state === 'skipped' || test.state === 'pending') {
              const testTitle = allTestTitles[i] || test.title;
              await client.addTestRun('failed', {
                error,
                suite_title: suiteTitle,
                title: testTitle,
                test_id: getTestomatIdFromTestTitle(testTitle),
                time: 0,
              });
            }
          }
        }

        delete this.hookFailures[suiteOrScenario.fullTitle];
      }
    }
  }

  /**
   * Extract all test titles from a spec file using AST parsing
   */
  extractTestsFromSpecFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const code = fs.readFileSync(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      const tests = [];

      _traverse(ast, {
        CallExpression(path) {
          if (
            path.node.callee.type === 'Identifier' &&
            path.node.callee.name === 'it' &&
            path.node.arguments.length >= 1
          ) {
            const firstArg = path.node.arguments[0];

            if (firstArg.type === 'StringLiteral') {
              tests.push(firstArg.value);
            }
            else if (firstArg.type === 'TemplateLiteral') {
              const parts = firstArg.quasis.map(q => q.value.raw);
              tests.push(`\`${parts.join('${...}')}\``);
            }
          }
        },
      });

      return tests;
    } catch (error) {
      console.error('[TESTOMATIO] Error parsing spec file:', error.message);
      return [];
    }
  }
}

export default WebdriverHooksEnhancer;

/**
 * Create and setup the enhancer for WebdriverReporter
 */
export function createHooksEnhancer(reporter) {
  const enhancer = new WebdriverHooksEnhancer();

  const originalOnHookEnd = reporter.onHookEnd?.bind(reporter);
  const originalOnSuiteEnd = reporter.onSuiteEnd?.bind(reporter);

  reporter.onHookEnd = function(hook) {
    enhancer.trackHookFailure(hook);
    if (originalOnHookEnd) {
      originalOnHookEnd(hook);
    }
  };

  reporter.onSuiteEnd = async function(suiteOrScenario) {
    await enhancer.handleSuiteEnd(
      suiteOrScenario,
      reporter.client,
      reporter.getTestomatIdFromTestTitle || ((title) => title)
    );
    if (originalOnSuiteEnd) {
      await originalOnSuiteEnd(suiteOrScenario);
    }
  };

  return enhancer;
}
