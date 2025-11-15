import createDebugMessages from 'debug';
import { STATUS } from '../constants.js';
import { fetchFilesFromStackTrace } from '../utils/utils.js';

const debug = createDebugMessages('@testomatio/reporter:nunit-parser');

/**
 * Enhanced NUnit XML Parser that properly handles test-suite hierarchy
 * and parameterized tests
 */
export class NUnitXmlParser {
  constructor(options = {}) {
    this.options = options;
    this.tests = [];
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      inconclusive: 0,
    };
  }

  /**
   * Parse NUnit XML test-run structure
   * @param {Object} testRun - Parsed XML test-run object
   * @returns {Object} - Parsed test results
   */
  parseTestRun(testRun) {
    debug('Parsing NUnit test-run');

    // Extract run-level statistics
    this.stats = {
      total: parseInt(testRun.total || 0, 10),
      passed: parseInt(testRun.passed || 0, 10),
      failed: parseInt(testRun.failed || 0, 10),
      skipped: parseInt(testRun.skipped || 0, 10),
      inconclusive: parseInt(testRun.inconclusive || 0, 10),
    };

    // Process the root test-suite
    if (testRun['test-suite']) {
      this.parseTestSuite(testRun['test-suite'], []);
    }

    debug(`Parsed ${this.tests.length} tests from NUnit XML`);

    return {
      status: testRun.result?.toLowerCase() || 'unknown',
      create_tests: true,
      tests_count: this.tests.length,
      passed_count: this.tests.filter(t => t.status === STATUS.PASSED).length,
      failed_count: this.tests.filter(t => t.status === STATUS.FAILED).length,
      skipped_count: this.tests.filter(t => t.status === STATUS.SKIPPED).length,
      tests: this.tests,
    };
  }

  /**
   * Recursively parse test-suite elements based on their type
   * @param {Object|Array} testSuite - Test suite object or array
   * @param {Array} parentPath - Current path in the hierarchy
   */
  parseTestSuite(testSuite, parentPath = []) {
    if (!testSuite) return;

    // Handle arrays of test suites
    if (Array.isArray(testSuite)) {
      testSuite.forEach(suite => this.parseTestSuite(suite, parentPath));
      return;
    }

    const suiteType = testSuite.type;
    const suiteName = testSuite.name;
    const fullName = testSuite.fullname;

    debug(`Processing test-suite: type=${suiteType}, name=${suiteName}`);

    switch (suiteType) {
      case 'Assembly':
        // Assembly level - ignore the name, just process children
        debug('Processing Assembly level - ignoring name, processing children');
        this.processChildren(testSuite, parentPath);
        break;

      case 'TestSuite':
        // Namespace/grouping level - add to path but don't create test
        debug(`Processing TestSuite level - adding '${suiteName}' to path`);
        // Avoid adding duplicate suite names to the path
        const newPath = parentPath[parentPath.length - 1] === suiteName ? [...parentPath] : [...parentPath, suiteName];
        this.processChildren(testSuite, newPath);
        break;

      case 'TestFixture':
        // Test class level - add to path and process test cases
        debug(`Processing TestFixture level - test class '${suiteName}'`);
        const testFixturePath = [...parentPath, suiteName];
        this.processChildren(testSuite, testFixturePath);
        break;

      case 'ParameterizedMethod':
        // Parameterized method level - process test cases directly
        debug(`Processing ParameterizedMethod level - method '${suiteName}'`);
        // Don't add to path, just process children directly
        this.processChildren(testSuite, parentPath);
        break;

      default:
        debug(`Unknown test-suite type: ${suiteType}, treating as TestSuite`);
        const unknownPath = [...parentPath, suiteName];
        this.processChildren(testSuite, unknownPath);
        break;
    }
  }

  /**
   * Process child elements of a test suite
   * @param {Object} testSuite - Test suite object
   * @param {Array} currentPath - Current path in hierarchy
   */
  processChildren(testSuite, currentPath) {
    // Process test-cases first (to maintain order)
    if (testSuite['test-case']) {
      this.parseTestCases(testSuite['test-case'], currentPath, testSuite);
    }

    // Process nested test-suites
    if (testSuite['test-suite']) {
      this.parseTestSuite(testSuite['test-suite'], currentPath);
    }
  }

  /**
   * Parse test-case elements (actual tests)
   * @param {Object|Array} testCases - Test case object or array
   * @param {Array} suitePath - Path to the test suite
   * @param {Object} parentSuite - Parent test suite for context
   */
  parseTestCases(testCases, suitePath, parentSuite) {
    if (!testCases) return;

    // Handle arrays of test cases
    if (!Array.isArray(testCases)) {
      testCases = [testCases];
    }

    testCases.forEach(testCase => {
      const parsedTest = this.parseTestCase(testCase, suitePath, parentSuite);
      if (parsedTest) {
        this.tests.push(parsedTest);
      }
    });
  }

  /**
   * Parse individual test case
   * @param {Object} testCase - Test case object
   * @param {Array} suitePath - Path to the test suite
   * @param {Object} parentSuite - Parent test suite for context
   * @returns {Object|null} - Parsed test object
   */
  parseTestCase(testCase, suitePath, parentSuite) {
    if (!testCase || !testCase.name) {
      debug('Skipping test case without name');
      return null;
    }

    // Use Description from properties if available (for SpecFlow tests), otherwise use name
    let testName = testCase.name;
    if (testCase.properties && testCase.properties.property) {
      const properties = Array.isArray(testCase.properties.property)
        ? testCase.properties.property
        : [testCase.properties.property];

      const descriptionProperty = properties.find(p => p.name === 'Description');
      if (descriptionProperty && descriptionProperty.value) {
        // Clean up SpecFlow description format: [C211256] Allow mobile print behavior -> Allow mobile print behavior
        testName = descriptionProperty.value.replace(/^\[[^\]]+\]\s*/, '');
      }
    }

    const fullName = testCase.fullname;
    const methodName = testCase.methodname || this.extractMethodName(testName);
    const className = testCase.classname || parentSuite?.name;

    debug(`Parsing test case: ${testName}`);
    debug(`Test case structure:`, JSON.stringify(testCase, null, 2));

    // Extract parameters if this is a parameterized test
    const { baseMethodName, parameters, isParameterized } = this.extractParameters(testName);

    // Determine test status
    let status = STATUS.PASSED;
    if (testCase.result) {
      switch (testCase.result.toLowerCase()) {
        case 'passed':
          status = STATUS.PASSED;
          break;
        case 'failed':
          status = STATUS.FAILED;
          break;
        case 'skipped':
        case 'ignored':
          status = STATUS.SKIPPED;
          break;
        case 'inconclusive':
          status = STATUS.SKIPPED; // Treat inconclusive as skipped
          break;
        default:
          status = STATUS.PASSED;
      }
    }

    // Extract error information
    let message = '';
    let stack = '';

    const files = [];

    // Extract attachments (NUnit format)
    if (testCase.attachments) {
      const attachments = Array.isArray(testCase.attachments.attachment)
        ? testCase.attachments.attachment
        : [testCase.attachments.attachment];

      const attachmentFiles = attachments.filter(a => a && a.filePath).map(a => a.filePath);
      files.push(...attachmentFiles);
    }

    if (testCase.failure) {
      message = testCase.failure.message || '';
      stack = testCase.failure['stack-trace'] || testCase.failure['#text'] || '';
    }

    if (testCase.output) {
      const outputText = typeof testCase.output === 'string' ? testCase.output : testCase.output['#text'];
      const stackFiles = fetchFilesFromStackTrace(outputText);
      files.push(...stackFiles);

      if (outputText) {
        debug(`Found output in test case: ${outputText.substring(0, 100)}...`);
        stack = `${stack}\n\n${outputText}`.trim();
      } else {
        debug('No output text found in test case');
      }
    } else {
      debug('No output found in test case');
    }

    // Extract test ID and tags from properties
    let testId = null;
    let tags = [];
    if (testCase.properties && testCase.properties.property) {
      const properties = Array.isArray(testCase.properties.property)
        ? testCase.properties.property
        : [testCase.properties.property];

      const idProperty = properties.find(p => p.name === 'ID');
      if (idProperty) {
        testId = idProperty.value;
        // Remove @ and T prefixes if present
        if (testId.startsWith('@')) testId = testId.slice(1);
        if (testId.startsWith('T')) testId = testId.slice(1);
      }

      // Extract Category properties as tags
      const categoryProperties = properties.filter(p => p.name === 'Category');
      tags = categoryProperties.map(p => p.value);
    }

    // If no test ID found in properties, try to extract from output
    if (!testId && testCase.output) {
      const outputText = typeof testCase.output === 'string' ? testCase.output : testCase.output['#text'];
      if (outputText) {
        debug(`Looking for test ID in output: ${outputText.substring(0, 200)}...`);
        const idMatch = outputText.match(/\[ID\]\s+tid:\/\/@T([a-f0-9]{8})/i);
        if (idMatch) {
          testId = idMatch[1];
          debug(`Found test ID in output: ${testId}`);
        } else {
          debug('No test ID found in output');
        }
      }
    }

    // Build file path from suite path and class name
    const filePath = this.buildFilePath(suitePath, className, parentSuite);

    // For parameterized tests, format example as expected by Testomatio API
    // Convert array of parameters to object with numeric keys
    let example = null;
    if (isParameterized && parameters.length > 0) {
      example = {};
      parameters.forEach((param, index) => {
        example[index] = param;
      });
    }

    return {
      // For runs: use full test name with parameters (TestBooleanValue(true))
      // For import: API will group by base name using the example field
      title: testName, // Full name with parameters for run display
      methodName: baseMethodName || methodName || testName,
      fullName: fullName,
      suitePath: suitePath,
      suite_title: className || suitePath[suitePath.length - 1] || 'Unknown',
      file: filePath,
      files: files, // Array of files that will be attached
      status: status,
      message: message,
      stack: stack,
      run_time: parseFloat(testCase.duration || testCase.time || 0) * 1000,
      test_id: testId,
      tags: tags, // Array of category tags from properties
      create: true,
      retry: false,
      // Parameterized test metadata
      example: example, // Parameters as object for API grouping
      isParameterized: isParameterized,
      parameters: parameters, // Keep original array for reference
      baseMethodName: baseMethodName,
    };
  }

  /**
   * Extract method name and parameters from test name
   * @param {string} testName - Full test name
   * @returns {Object} - Extracted information
   */
  extractParameters(testName) {
    const paramMatch = testName.match(/^(.+?)\((.+)\)$/);

    if (paramMatch) {
      const baseMethodName = paramMatch[1].trim();
      const paramString = paramMatch[2];

      // Parse parameters - handle quoted strings and nested structures
      const parameters = this.parseParameterString(paramString);

      return {
        baseMethodName: baseMethodName,
        parameters: parameters,
        isParameterized: true,
      };
    }

    return {
      baseMethodName: testName,
      parameters: [],
      isParameterized: false,
    };
  }

  /**
   * Parse parameter string into array of parameters
   * @param {string} paramString - Parameter string
   * @returns {Array} - Array of parameters
   */
  parseParameterString(paramString) {
    const parameters = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    let depth = 0;

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = null;
        current += char;
      } else if (!inQuotes && char === '(') {
        depth++;
        current += char;
      } else if (!inQuotes && char === ')') {
        depth--;
        current += char;
      } else if (!inQuotes && char === ',' && depth === 0) {
        parameters.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parameters.push(current.trim());
    }

    // Clean up parameters - remove quotes if they wrap the entire parameter and filter empty ones
    return parameters
      .map(param => {
        param = param.trim();
        if ((param.startsWith('"') && param.endsWith('"')) || (param.startsWith("'") && param.endsWith("'"))) {
          return param.slice(1, -1);
        }
        return param;
      })
      .filter(p => !!p);
  }

  /**
   * Extract method name from test name (fallback)
   * @param {string} testName - Test name
   * @returns {string} - Method name
   */
  extractMethodName(testName) {
    // Remove parameters if present
    const paramMatch = testName.match(/^(.+?)\(/);
    return paramMatch ? paramMatch[1].trim() : testName;
  }

  /**
   * Build file path from suite path and class name
   * @param {Array} suitePath - Suite path array
   * @param {string} className - Class name
   * @param {Object} parentSuite - Parent suite for context
   * @returns {string} - File path
   */
  buildFilePath(suitePath, className, parentSuite) {
    // Try to get file path from parent suite
    if (parentSuite && parentSuite.filepath) {
      return parentSuite.filepath;
    }

    // Build path from suite hierarchy
    const pathParts = [...suitePath];
    if (className && !pathParts.includes(className)) {
      pathParts.push(className);
    }

    // Convert to file path format
    return pathParts.join('/') + '.cs'; // Assume C# for NUnit
  }

  /**
   * Group parameterized tests by base method name
   * @param {Array} tests - Array of parsed tests
   * @returns {Object} - Grouped tests
   */
  groupParameterizedTests(tests) {
    const grouped = {};

    tests.forEach(test => {
      const key = test.isParameterized
        ? `${test.suitePath.join('.')}.${test.baseMethodName}`
        : `${test.suitePath.join('.')}.${test.title}`;

      if (!grouped[key]) {
        grouped[key] = {
          baseTest: {
            name: test.baseMethodName || test.title,
            suitePath: test.suitePath,
            suite_title: test.suite_title,
            file: test.file,
            isParameterized: test.isParameterized,
          },
          variations: [],
        };
      }

      grouped[key].variations.push(test);
    });

    return grouped;
  }
}

export default NUnitXmlParser;
