/**
 * WebdriverIO Hooks Enhancer
 *
 * Tracks and reports all tests as failed when beforeEach hook fails
 */

const parser = require('@babel/parser');
const _traverse = require('@babel/traverse').default;
const fs = require('fs');

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

        const allTests = this.extractTestsFromSpecFile(suiteOrScenario.file);

        const allTestsCount = allTests.length;
        const ranTestsCount = (suiteOrScenario.tests || []).length;

        // Report tests that didn't run due to hook failure
        for (let i = ranTestsCount; i < allTestsCount; i++) {
          const test = allTests[i];
          await client.addTestRun('failed', {
            error,
            suite_title: suiteTitle,
            title: test.title,
            test_id: getTestomatIdFromTestTitle(test.title),
            time: 0,
            links: test.links || [],
          });
        }

        if (suiteOrScenario.tests) {
          for (let i = 0; i < suiteOrScenario.tests.length; i++) {
            const test = suiteOrScenario.tests[i];
            if (!test.state || test.state === 'skipped' || test.state === 'pending') {
              const testInfo = allTests[i] || { title: test.title, links: [] };
              await client.addTestRun('failed', {
                error,
                suite_title: suiteTitle,
                title: testInfo.title,
                test_id: getTestomatIdFromTestTitle(testInfo.title),
                time: 0,
                links: testInfo.links || [],
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
   * Also extracts linkTest, linkJira, and label calls from test bodies
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
      const self = this;

      _traverse(ast, {
        CallExpression(path) {
          if (
            path.node.callee.type === 'Identifier' &&
            path.node.callee.name === 'it' &&
            path.node.arguments.length >= 1
          ) {
            const firstArg = path.node.arguments[0];
            let testTitle = '';

            if (firstArg.type === 'StringLiteral') {
              testTitle = firstArg.value;
            }
            else if (firstArg.type === 'TemplateLiteral') {
              const parts = firstArg.quasis.map(q => q.value.raw);
              testTitle = `\`${parts.join('${...}')}\``;
            }

            if (!testTitle) return;

            const links = self.extractLinksFromTest(path);

            tests.push({
              title: testTitle,
              links: links
            });
          }
        },
      });

      return tests;
    } catch (error) {
      console.error('[TESTOMATIO] Error parsing spec file:', error.message);
      return [];
    }
  }

  /**
   * Extract linkTest, linkJira, and label calls from a test body
   */
  extractLinksFromTest(testPath) {
    const links = [];

    if (testPath.node.arguments.length < 2) return links;

    const bodyPath = testPath.get('arguments.1');
    if (!bodyPath.isFunctionExpression() && !bodyPath.isArrowFunctionExpression()) {
      return links;
    }

    bodyPath.traverse({
      CallExpression(innerPath) {
        const callee = innerPath.node.callee;

        if (callee.type === 'Identifier') {
          const funcName = callee.name;

          if (funcName === 'linkTest' || funcName === 'linkJira' || funcName === 'label') {
            const args = innerPath.node.arguments;

            for (const arg of args) {
              let values = [];

              if (arg.type === 'StringLiteral') {
                values.push(arg.value);
              }

              else if (arg.type === 'ArrayExpression') {
                for (const element of arg.elements) {
                  if (element.type === 'StringLiteral') {
                    values.push(element.value);
                  }
                }
              }

              for (const value of values) {
                if (funcName === 'linkTest') {
                  links.push({ test: value });
                } else if (funcName === 'linkJira') {
                  links.push({ jira: value });
                } else if (funcName === 'label') {
                  links.push({ label: value });
                }
              }
            }
          }
        }
      }
    });

    return links;
  }
}

/**
 * Create and setup the enhancer for WebdriverReporter
 */
function createHooksEnhancer(reporter) {
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

module.exports = { createHooksEnhancer, WebdriverHooksEnhancer };
