import path from 'path';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import XmlReader from '../../src/xmlReader.js';
import { NUnitXmlParser } from '../../src/junit-adapter/nunit-parser.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Enhanced NUnit XML Parser', () => {
  describe('NUnitXmlParser class', () => {
    it('should parse test-suite hierarchy correctly', () => {
      const parser = new NUnitXmlParser();

      const mockTestRun = {
        total: 2,
        passed: 1,
        failed: 1,
        skipped: 0,
        inconclusive: 0,
        result: 'Failed',
        'test-suite': {
          type: 'Assembly',
          name: 'Tests.dll',
          'test-suite': {
            type: 'TestSuite',
            name: 'Tests',
            'test-suite': {
              type: 'TestFixture',
              name: 'SimpleTests',
              'test-case': [
                {
                  name: 'TestMethod1',
                  fullname: 'Tests.SimpleTests.TestMethod1',
                  methodname: 'TestMethod1',
                  classname: 'Tests.SimpleTests',
                  result: 'Passed',
                  duration: '1.0',
                },
                {
                  name: 'TestMethod2',
                  fullname: 'Tests.SimpleTests.TestMethod2',
                  methodname: 'TestMethod2',
                  classname: 'Tests.SimpleTests',
                  result: 'Failed',
                  duration: '1.5',
                  failure: {
                    message: 'Test failed',
                    'stack-trace': 'at Tests.SimpleTests.TestMethod2() line 10',
                  },
                },
              ],
            },
          },
        },
      };

      const result = parser.parseTestRun(mockTestRun);

      expect(result.tests_count).to.equal(2);
      expect(result.tests.length).to.equal(2);
      expect(result.passed_count).to.equal(1);
      expect(result.failed_count).to.equal(1);

      const test1 = result.tests[0];
      expect(test1.title).to.equal('TestMethod1');
      expect(test1.status).to.equal('passed');
      expect(test1.suitePath).to.deep.equal(['Tests', 'SimpleTests']);
      expect(test1.isParameterized).to.be.false;

      const test2 = result.tests[1];
      expect(test2.title).to.equal('TestMethod2');
      expect(test2.status).to.equal('failed');
      expect(test2.message).to.equal('Test failed');
      expect(test2.stack).to.include('at Tests.SimpleTests.TestMethod2() line 10');
    });

    it('should extract parameters from parameterized tests correctly', () => {
      const parser = new NUnitXmlParser();

      // Test simple parameters
      let result = parser.extractParameters('Add(2,3,5)');
      expect(result.baseMethodName).to.equal('Add');
      expect(result.parameters).to.deep.equal(['2', '3', '5']);
      expect(result.isParameterized).to.be.true;

      // Test quoted parameters
      result = parser.extractParameters('Test("hello","world",123)');
      expect(result.baseMethodName).to.equal('Test');
      expect(result.parameters).to.deep.equal(['hello', 'world', '123']);
      expect(result.isParameterized).to.be.true;

      // Test complex parameters
      result = parser.extractParameters('ComplexTest("string with, comma",null,true)');
      expect(result.baseMethodName).to.equal('ComplexTest');
      expect(result.parameters).to.deep.equal(['string with, comma', 'null', 'true']);
      expect(result.isParameterized).to.be.true;

      // Test non-parameterized test
      result = parser.extractParameters('SimpleTest');
      expect(result.baseMethodName).to.equal('SimpleTest');
      expect(result.parameters).to.deep.equal([]);
      expect(result.isParameterized).to.be.false;
    });

    it('should group parameterized tests correctly', () => {
      const parser = new NUnitXmlParser();

      const tests = [
        {
          title: 'Add(2,3,5)',
          methodName: 'Add',
          baseMethodName: 'Add',
          suitePath: ['Tests', 'Calculator'],
          suite_title: 'Calculator',
          isParameterized: true,
          parameters: ['2', '3', '5'],
          status: 'passed',
        },
        {
          title: 'Add(10,20,30)',
          methodName: 'Add',
          baseMethodName: 'Add',
          suitePath: ['Tests', 'Calculator'],
          suite_title: 'Calculator',
          isParameterized: true,
          parameters: ['10', '20', '30'],
          status: 'passed',
        },
        {
          title: 'Subtract',
          methodName: 'Subtract',
          baseMethodName: 'Subtract',
          suitePath: ['Tests', 'Calculator'],
          suite_title: 'Calculator',
          isParameterized: false,
          parameters: [],
          status: 'passed',
        },
      ];

      const grouped = parser.groupParameterizedTests(tests);

      expect(Object.keys(grouped)).to.have.length(2);

      const addGroup = grouped['Tests.Calculator.Add'];
      expect(addGroup).to.exist;
      expect(addGroup.variations).to.have.length(2);
      expect(addGroup.baseTest.name).to.equal('Add');
      expect(addGroup.baseTest.isParameterized).to.be.true;

      const subtractGroup = grouped['Tests.Calculator.Subtract'];
      expect(subtractGroup).to.exist;
      expect(subtractGroup.variations).to.have.length(1);
      expect(subtractGroup.baseTest.name).to.equal('Subtract');
      expect(subtractGroup.baseTest.isParameterized).to.be.false;
    });
  });

  describe('XmlReader with enhanced NUnit parser', () => {
    it('should not create duplicate tests from TestSuite elements', () => {
      const reader = new XmlReader({
        enhancedNunit: true,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      expect(jsonData.status).to.equal('failed');
      expect(jsonData.tests_count).to.equal(9); // 9 actual test cases
      expect(jsonData.tests.length).to.equal(9);

      // Verify no duplicate tests from TestSuite names
      const testNames = jsonData.tests.map(t => t.title);
      expect(testNames).not.to.include('Action_Log');
      expect(testNames).not.to.include('ActionLogScenarios');
      expect(testNames).not.to.include('Calculator');
      expect(testNames).not.to.include('CalculatorTests');
      expect(testNames).not.to.include('Billing');
      expect(testNames).not.to.include('Tests');
      expect(testNames).not.to.include('NUnit_Tests');

      // Verify actual test names are present
      expect(testNames).to.include('TestMethod1');
      expect(testNames).to.include('TestMethod2');
      expect(testNames).to.include('Add(2,3,5)');
      expect(testNames).to.include('Add(10,20,30)');
      expect(testNames).to.include('Add(-1,1,0)');
      expect(testNames).to.include('Multiply(2,3,6)');
      expect(testNames).to.include('Multiply(4,5,20)');
      expect(testNames).to.include('Subtract');
      expect(testNames).to.include('Divide("10.5","2.5",4.2)');
    });

    it('should handle parameterized tests as separate test instances', () => {
      const reader = new XmlReader({
        enhancedNunit: true,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      // Find parameterized Add tests
      const addTests = jsonData.tests.filter(t => t.baseMethodName === 'Add');
      expect(addTests).to.have.length(3);

      // Verify each variation is a separate test
      const addTest1 = addTests.find(t => t.title === 'Add(2,3,5)');
      expect(addTest1).to.exist;
      expect(addTest1.status).to.equal('passed');
      expect(addTest1.parameters).to.deep.equal(['2', '3', '5']);
      expect(addTest1.isParameterized).to.be.true;

      const addTest2 = addTests.find(t => t.title === 'Add(10,20,30)');
      expect(addTest2).to.exist;
      expect(addTest2.status).to.equal('passed');
      expect(addTest2.parameters).to.deep.equal(['10', '20', '30']);

      const addTest3 = addTests.find(t => t.title === 'Add(-1,1,0)');
      expect(addTest3).to.exist;
      expect(addTest3.status).to.equal('failed');
      expect(addTest3.parameters).to.deep.equal(['-1', '1', '0']);
      expect(addTest3.message).to.equal('Expected 0 but got 1');
    });

    it('should preserve test hierarchy and file paths', () => {
      const reader = new XmlReader({
        enhancedNunit: true,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      const actionLogTest = jsonData.tests.find(t => t.title === 'TestMethod1');
      expect(actionLogTest).to.exist;
      expect(actionLogTest.suite_title).to.equal('Tests.NUnit_Tests.Billing.Action_Log.ActionLogScenarios');
      expect(actionLogTest.suitePath).to.deep.equal([
        'Tests',
        'NUnit_Tests',
        'Billing',
        'Action_Log',
        'ActionLogScenarios',
      ]);
      expect(actionLogTest.file).to.include('ActionLogScenarios.cs');

      const calculatorTest = jsonData.tests.find(t => t.title === 'Add(2,3,5)');
      expect(calculatorTest).to.exist;
      expect(calculatorTest.suite_title).to.equal('Tests.NUnit_Tests.Billing.Calculator.CalculatorTests');
      expect(calculatorTest.suitePath).to.deep.equal([
        'Tests',
        'NUnit_Tests',
        'Billing',
        'Calculator',
        'CalculatorTests',
      ]);
      expect(calculatorTest.file).to.include('CalculatorTests.cs');
    });

    it('should extract test IDs from properties correctly', () => {
      const reader = new XmlReader({
        enhancedNunit: true,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      const testMethod1 = jsonData.tests.find(t => t.title === 'TestMethod1');
      expect(testMethod1.test_id).to.equal('12345678');

      const testMethod2 = jsonData.tests.find(t => t.title === 'TestMethod2');
      expect(testMethod2.test_id).to.equal('87654321');

      const addTest = jsonData.tests.find(t => t.title === 'Add(2,3,5)');
      expect(addTest.test_id).to.equal('11111111');
    });

    it('should handle complex parameter parsing', () => {
      const reader = new XmlReader({
        enhancedNunit: true,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      const divideTest = jsonData.tests.find(t => t.title === 'Divide("10.5","2.5",4.2)');
      expect(divideTest).to.exist;
      expect(divideTest.parameters).to.deep.equal(['10.5', '2.5', '4.2']);
      expect(divideTest.baseMethodName).to.equal('Divide');
      expect(divideTest.isParameterized).to.be.true;
    });

    it('should calculate correct statistics', () => {
      const reader = new XmlReader({
        enhancedNunit: true,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      expect(jsonData.tests_count).to.equal(9);
      expect(jsonData.passed_count).to.equal(7);
      expect(jsonData.failed_count).to.equal(2);
      expect(jsonData.skipped_count).to.equal(0);

      const stats = reader.calculateStats();
      expect(stats.tests_count).to.equal(9);
      expect(stats.passed_count).to.equal(7);
      expect(stats.failed_count).to.equal(2);
      expect(stats.status).to.equal('failed');
    });
  });

  describe('Backward compatibility', () => {
    it('should use legacy parser when enhanced NUnit is disabled', () => {
      const reader = new XmlReader({
        enhancedNunit: false,
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_parameterized.xml'));

      // Legacy behavior - should work as before
      expect(jsonData.tests_count).to.be.greaterThan(0);
      expect(jsonData.tests.length).to.be.greaterThan(0);
    });

    it('should fallback to legacy parser on enhanced parser failure', () => {
      const reader = new XmlReader({
        lang: 'c#',
        // Enhanced parser is enabled by default
      });

      // This should trigger fallback behavior if enhanced parser fails
      const jsonData = reader.parse(path.join(dirname, 'data/junit1.xml'));

      // Should still process the file successfully
      expect(jsonData.tests_count).to.be.greaterThan(0);
      expect(jsonData.tests.length).to.be.greaterThan(0);
    });

    it('should work with existing JUnit XML files', () => {
      const reader = new XmlReader({
        lang: 'java',
        // Enhanced parser is enabled by default but should not affect JUnit XML
      });

      const jsonData = reader.parse(path.join(dirname, 'data/java.xml'));

      // Should process JUnit XML normally (enhanced parser should not interfere)
      expect(jsonData.tests_count).to.equal(jsonData.tests.length);
      expect(jsonData.tests.length).to.be.greaterThan(0);
      expect(jsonData.tests.length).to.equal(jsonData.tests_count);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed test cases gracefully', () => {
      const parser = new NUnitXmlParser();

      const mockTestRun = {
        total: 1,
        passed: 0,
        failed: 0,
        skipped: 0,
        inconclusive: 0,
        result: 'Passed',
        'test-suite': {
          type: 'TestFixture',
          name: 'TestClass',
          'test-case': {
            // Missing required fields
            result: 'Passed',
          },
        },
      };

      const result = parser.parseTestRun(mockTestRun);

      // Should handle gracefully and not crash
      expect(result.tests_count).to.equal(0);
      expect(result.tests.length).to.equal(0);
    });

    it('should handle empty test suites', () => {
      const parser = new NUnitXmlParser();

      const mockTestRun = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        inconclusive: 0,
        result: 'Passed',
        'test-suite': {
          type: 'TestFixture',
          name: 'EmptyTestClass',
          // No test-case elements
        },
      };

      const result = parser.parseTestRun(mockTestRun);

      expect(result.tests_count).to.equal(0);
      expect(result.tests.length).to.equal(0);
      expect(result.status).to.equal('passed');
    });
  });
});
