import path from 'path';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import XmlReader from '../../src/xmlReader.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe('All NUnit XML Files Tests', () => {
  describe('nunit_data_provider_fix.xml', () => {
    it('should parse NUnit XML with ParameterizedMethod test suites correctly', () => {
      const reader = new XmlReader({
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_data_provider_fix.xml'));

      expect(jsonData.status).to.equal('passed');
      expect(jsonData.tests_count).to.equal(6); // 2 TestBooleanValue + 3 TestAddition + 1 SamplePTest
      expect(jsonData.tests.length).to.equal(6);

      // Verify no duplicate tests from TestSuite names
      const testNames = jsonData.tests.map(t => t.title);
      expect(testNames).not.to.include('NUnit_sample_test');
      expect(testNames).not.to.include('Tests');
      expect(testNames).not.to.include('SampleTests');
      expect(testNames).not.to.include('TestBooleanValue'); // ParameterizedMethod suite name
      expect(testNames).not.to.include('TestAddition'); // ParameterizedMethod suite name

      // Verify actual test names are present
      expect(testNames).to.include('TestBooleanValue(True)');
      expect(testNames).to.include('TestBooleanValue(False)');
      expect(testNames).to.include('TestAddition(1,2,3)');
      expect(testNames).to.include('TestAddition(5,10,15)');
      expect(testNames).to.include('TestAddition(-1,-2,-3)');
      expect(testNames).to.include('SamplePTest');

      // Verify parameterized tests have correct parameters
      const booleanTrueTest = jsonData.tests.find(t => t.title === 'TestBooleanValue(True)');
      expect(booleanTrueTest).to.exist;
      expect(booleanTrueTest.parameters).to.deep.equal(['True']);
      expect(booleanTrueTest.baseMethodName).to.equal('TestBooleanValue');
      expect(booleanTrueTest.isParameterized).to.be.true;

      const additionTest = jsonData.tests.find(t => t.title === 'TestAddition(1,2,3)');
      expect(additionTest).to.exist;
      expect(additionTest.parameters).to.deep.equal(['1', '2', '3']);
      expect(additionTest.baseMethodName).to.equal('TestAddition');
      expect(additionTest.isParameterized).to.be.true;

      // Verify regular test
      const regularTest = jsonData.tests.find(t => t.title === 'SamplePTest');
      expect(regularTest).to.exist;
      expect(regularTest.isParameterized).to.be.false;
      expect(regularTest.parameters).to.deep.equal([]);
    });
  });

  describe('nunit_enhanced_test.xml', () => {
    it('should parse complex NUnit XML with multiple test suites and parameterized tests', () => {
      const reader = new XmlReader({
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_enhanced_test.xml'));

      expect(jsonData.status).to.equal('failed');
      expect(jsonData.tests_count).to.equal(9);
      expect(jsonData.tests.length).to.equal(9);

      // Verify no duplicate tests from TestSuite elements
      const testNames = jsonData.tests.map(t => t.title);
      expect(testNames).not.to.include('Action_Log');
      expect(testNames).not.to.include('ActionLogScenarios');
      expect(testNames).not.to.include('Calculator');
      expect(testNames).not.to.include('CalculatorTests');

      // Verify all expected tests are present
      expect(testNames).to.include('TestMethod1');
      expect(testNames).to.include('TestMethod2');
      expect(testNames).to.include('Add(2,3,5)');
      expect(testNames).to.include('Add(10,20,30)');
      expect(testNames).to.include('Add(-1,1,0)');
      expect(testNames).to.include('Multiply(2,3,6)');
      expect(testNames).to.include('Multiply(4,5,20)');
      expect(testNames).to.include('Subtract');
      expect(testNames).to.include('Divide("10.5","2.5",4.2)');

      // Verify test IDs are extracted correctly
      const testMethod1 = jsonData.tests.find(t => t.title === 'TestMethod1');
      expect(testMethod1.test_id).to.equal('12345678');

      const addTest = jsonData.tests.find(t => t.title === 'Add(2,3,5)');
      expect(addTest.test_id).to.equal('11111111');

      // Verify complex parameter parsing
      const divideTest = jsonData.tests.find(t => t.title === 'Divide("10.5","2.5",4.2)');
      expect(divideTest.parameters).to.deep.equal(['10.5', '2.5', '4.2']);
    });
  });

  describe('nunit_parameterized.xml', () => {
    it('should parse parameterized NUnit XML correctly', () => {
      const reader = new XmlReader({
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit_parameterized.xml'));

      expect(jsonData.status).to.equal('failed');
      expect(jsonData.tests_count).to.equal(2);
      expect(jsonData.tests.length).to.equal(2);

      // Verify parameterized test variations
      const test1 = jsonData.tests.find(t => t.title === 'PostCashTransactionOnCashierPageNew(True)');
      const test2 = jsonData.tests.find(t => t.title === 'PostCashTransactionOnCashierPageNew(False)');

      expect(test1).to.exist;
      expect(test2).to.exist;

      expect(test1.status).to.equal('passed');
      expect(test2.status).to.equal('failed');

      expect(test1.parameters).to.deep.equal(['True']);
      expect(test2.parameters).to.deep.equal(['False']);

      expect(test1.baseMethodName).to.equal('PostCashTransactionOnCashierPageNew');
      expect(test2.baseMethodName).to.equal('PostCashTransactionOnCashierPageNew');
    });
  });

  describe('nunit.xml (TRX format)', () => {
    it('should parse NUnit TRX XML correctly', () => {
      const reader = new XmlReader({
        lang: 'c#',
      });

      const jsonData = reader.parse(path.join(dirname, 'data/nunit.xml'));

      expect(jsonData.status).to.equal('passed');
      expect(jsonData.tests_count).to.equal(2);
      expect(jsonData.tests.length).to.equal(2);

      // Verify TRX format tests
      const tests = jsonData.tests;
      tests.forEach(test => {
        expect(test.title).to.include('CreateUserLogin'); // TRX format uses different naming
        expect(test.suite_title).to.include('User');
      });
    });
  });

  describe('Backward compatibility with all formats', () => {
    it('should handle all NUnit XML formats without errors', () => {
      const reader = new XmlReader({
        lang: 'c#',
      });

      const testFiles = [
        'nunit_data_provider_fix.xml',
        'nunit_enhanced_test.xml',
        'nunit_parameterized.xml',
        'nunit.xml',
      ];

      testFiles.forEach(fileName => {
        expect(() => {
          const jsonData = reader.parse(path.join(dirname, 'data', fileName));
          expect(jsonData).to.exist;
          expect(jsonData.tests).to.be.an('array');
          expect(jsonData.tests_count).to.be.a('number');
        }).to.not.throw(`Failed to parse ${fileName}`);
      });
    });
  });

  describe('Enhanced parser automatic detection', () => {
    it('should automatically use enhanced parser for NUnit XML files', () => {
      const reader = new XmlReader({
        lang: 'c#',
      });

      // Test with nunit_data_provider_fix.xml which has ParameterizedMethod suites
      const jsonData = reader.parse(path.join(dirname, 'data/nunit_data_provider_fix.xml'));

      // Enhanced parser should handle ParameterizedMethod suites correctly
      expect(jsonData.tests_count).to.equal(6);

      // Should not create tests from ParameterizedMethod suite names
      const testNames = jsonData.tests.map(t => t.title);
      expect(testNames).not.to.include('TestBooleanValue'); // Suite name
      expect(testNames).not.to.include('TestAddition'); // Suite name

      // Should create tests from actual test-case elements
      expect(testNames).to.include('TestBooleanValue(True)');
      expect(testNames).to.include('TestAddition(1,2,3)');
    });
  });
});
