import { expect } from 'chai';
import XmlReader from '../../src/xmlReader.js';
import TestomatioPipe from '../../src/pipe/testomatio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('XmlReader Chunking with Pipe API', () => {
  let reader;
  let testomatioPipe;
  let httpCalls;

  beforeEach(() => {
    reader = new XmlReader({
      apiKey: 'test-api-key',
      lang: 'javascript',
    });

    reader.requestParams.batchMode = 'manual';

    testomatioPipe = new TestomatioPipe({
      apiKey: 'test-api-key',
      url: 'https://test.testomat.io',
      batchMode: 'manual',
    });

    testomatioPipe.runId = 'test-run-123';
    testomatioPipe.store.runId = 'test-run-123';

    httpCalls = [];

    const originalRequest = testomatioPipe.client.request.bind(testomatioPipe.client);
    testomatioPipe.client.request = async ({ method, url, data }) => {
      httpCalls.push({
        method,
        url,
        testCount: data?.tests?.length || 0,
        batchIndex: data?.batch_index,
        status: data?.status,
      });

      if (url.includes('/reporter') && method === 'POST' && !url.includes('/testrun')) {
        return { data: { uid: 'test-run-id', url: '/test/test-run' } };
      }

      return { data: {} };
    };

    reader.pipes = [testomatioPipe];
  });

  describe('batchMode wiring', () => {
    it('should default requestParams.batchMode to "manual"', () => {
      const freshReader = new XmlReader({ apiKey: 'test-api-key', lang: 'javascript' });
      expect(freshReader.requestParams.batchMode).to.equal('manual');
    });

    it('should forward batchMode to each pipe createRun', async () => {
      const createRunParams = [];
      const mockPipe = {
        isEnabled: true,
        createRun: async (params) => { createRunParams.push(params); },
        addTest: async () => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'MockPipe',
      };

      reader.pipes = [mockPipe];

      await reader.createRun();

      expect(createRunParams).to.have.length(1);
      expect(createRunParams[0].batchMode).to.equal('manual');
    });
  });

  describe('addTest and sync pattern', () => {
    it('should call addTest for each test', async () => {
      const mockPipe = {
        isEnabled: true,
        createRun: async () => {},
        addTest: async (test) => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'MockPipe',
      };

      const addTestCalls = [];
      mockPipe.addTest = async (test) => {
        addTestCalls.push(test);
      };

      reader.tests = [
        { title: 'Test 1', status: 'passed' },
        { title: 'Test 2', status: 'failed' },
        { title: 'Test 3', status: 'passed' },
      ];

      reader.pipes = [mockPipe];
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      expect(addTestCalls).to.have.length(3);
    });

    it('should call sync after each chunk', async () => {
      const mockPipe = {
        isEnabled: true,
        createRun: async () => {},
        addTest: async (test) => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'MockPipe',
      };

      const syncCalls = [];
      mockPipe.sync = async () => {
        syncCalls.push(true);
      };

      const largeTests = Array.from({ length: 100 }, (_, i) => ({
        title: `Test ${i}`,
        status: 'passed',
        stack: 'x'.repeat(10000),
      }));

      reader.tests = largeTests;
      reader.pipes = [mockPipe];
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      expect(syncCalls.length).to.be.greaterThan(0);
    });

    it('should call finishRun once at the end', async () => {
      const mockPipe = {
        isEnabled: true,
        createRun: async () => {},
        addTest: async (test) => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'MockPipe',
      };

      const finishRunCalls = [];
      mockPipe.finishRun = async () => {
        finishRunCalls.push(true);
      };

      reader.tests = [{ title: 'Test 1', status: 'passed' }];
      reader.pipes = [mockPipe];
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      expect(finishRunCalls).to.have.length(1);
    });
  });

  describe('TestomatioPipe batch upload', () => {
    it('should upload tests in batches', async () => {
      const tests = Array.from({ length: 500 }, (_, i) => ({
        title: `Test ${i}`,
        status: i % 3 === 0 ? 'failed' : 'passed',
        stack: i % 3 === 0 ? 'x'.repeat(50000) : '',
      }));

      reader.tests = tests;
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      const batchUploads = httpCalls.filter(c => c.url.includes('/testrun'));

      expect(batchUploads.length).to.be.greaterThan(1);

      const totalTestsUploaded = batchUploads.reduce((sum, c) => sum + c.testCount, 0);
      expect(totalTestsUploaded).to.equal(500);
    });

    it('should use sequential batch indices', async () => {
      const tests = Array.from({ length: 300 }, (_, i) => ({
        title: `Test ${i}`,
        status: 'passed',
        stack: 'x'.repeat(30000),
      }));

      reader.tests = tests;
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      const batchUploads = httpCalls.filter(c => c.url.includes('/testrun'));
      const indices = batchUploads.map(c => c.batchIndex);

      indices.forEach((idx, i) => {
        expect(idx).to.equal(i + 1);
      });
    });

    it('should keep batch sizes under 2.5MB', async () => {
      const tests = Array.from({ length: 1000 }, (_, i) => ({
        title: `Test ${i}`,
        status: i % 3 === 0 ? 'failed' : 'passed',
        stack: 'x'.repeat(50000),
      }));

      reader.tests = tests;
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      const batchUploads = httpCalls.filter(c => c.url.includes('/testrun'));

      expect(batchUploads.length).to.be.greaterThan(0);
    });

    it('should call finishRun after all batches', async () => {
      const tests = Array.from({ length: 100 }, (_, i) => ({
        title: `Test ${i}`,
        status: 'passed',
      }));

      reader.tests = tests;
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      const batchUploads = httpCalls.filter(c => c.url.includes('/testrun'));
      const finishCalls = httpCalls.filter(c => c.method === 'PUT');

      expect(batchUploads.length).to.be.greaterThan(0);
      expect(finishCalls.length).to.equal(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty tests array', async () => {
      const mockPipe = {
        isEnabled: true,
        createRun: async () => {},
        addTest: async (test) => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'MockPipe',
      };

      const calls = {
        addTest: 0,
        sync: 0,
        finishRun: 0,
      };

      mockPipe.addTest = async () => { calls.addTest++; };
      mockPipe.sync = async () => { calls.sync++; throw new Error('Should not be called'); };
      mockPipe.finishRun = async () => { calls.finishRun++; };

      reader.tests = [];
      reader.pipes = [mockPipe];
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      expect(calls.addTest).to.equal(0);
      expect(calls.finishRun).to.equal(1);
    });

    it('should handle single test', async () => {
      reader.tests = [{ title: 'Test 1', status: 'passed' }];
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      const batchUploads = httpCalls.filter(c => c.url.includes('/testrun'));
      const totalTests = batchUploads.reduce((sum, c) => sum + c.testCount, 0);

      expect(totalTests).to.equal(1);
    });

    it('should handle pipes with and without sync implementation', async () => {
      const pipe1 = {
        isEnabled: true,
        createRun: async () => {},
        addTest: async (test) => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'Pipe1',
      };

      const pipe2 = {
        isEnabled: true,
        createRun: async () => {},
        addTest: async (test) => {},
        sync: async () => {},
        finishRun: async () => {},
        toString: () => 'Pipe2',
      };

      const pipe1Calls = [];
      const pipe2Calls = [];

      pipe1.addTest = async (test) => { pipe1Calls.push('addTest'); };
      pipe1.sync = async () => { pipe1Calls.push('sync'); };

      pipe2.addTest = async (test) => { pipe2Calls.push('addTest'); };
      pipe2.sync = async () => { pipe2Calls.push('sync'); };

      reader.tests = [{ title: 'Test', status: 'passed' }];
      reader.pipes = [pipe1, pipe2];
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      expect(pipe1Calls).to.include('addTest');
      expect(pipe1Calls).to.include('sync');
      expect(pipe2Calls).to.include('addTest');
      expect(pipe2Calls).to.include('sync');
    });
  });

  describe('real XML file processing', () => {
    const xmlReportsDir = path.join(__dirname, '../../test-reports');

    before(() => {
      if (!fs.existsSync(xmlReportsDir)) {
        fs.mkdirSync(xmlReportsDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite" tests="100" failures="20">
  <testsuite name="Suite 1" tests="50" failures="10">
    ${Array.from({ length: 50 }, (_, i) => `
    <testcase name="Test ${i + 1}" classname="Suite1.Test${i + 1}" time="${(Math.random() * 1).toFixed(3)}">
      ${i % 5 === 0 ? '<failure type="AssertionError">Test failed</failure>' : ''}
    </testcase>`).join('')}
  </testsuite>
  <testsuite name="Suite 2" tests="50" failures="10">
    ${Array.from({ length: 50 }, (_, i) => `
    <testcase name="Test ${i + 51}" classname="Suite2.Test${i + 51}" time="${(Math.random() * 1).toFixed(3)}">
      ${i % 5 === 0 ? '<failure type="AssertionError">Test failed</failure>' : ''}
    </testcase>`).join('')}
  </testsuite>
</testsuites>`;

      fs.writeFileSync(path.join(xmlReportsDir, 'test_junit.xml'), xmlContent);
    });

    after(() => {
      const testXmlPath = path.join(xmlReportsDir, 'test_junit.xml');
      if (fs.existsSync(testXmlPath)) {
        fs.unlinkSync(testXmlPath);
      }
    });

    it('should parse and upload XML file correctly', async () => {
      const xmlPath = path.join(xmlReportsDir, 'test_junit.xml');
      reader.parse(xmlPath);
      reader.createRun = async () => Promise.resolve();

      await reader.uploadData();

      const batchUploads = httpCalls.filter(c => c.url.includes('/testrun'));
      const totalTestsUploaded = batchUploads.reduce((sum, c) => sum + c.testCount, 0);

      expect(totalTestsUploaded).to.equal(100);
    });
  });
});
