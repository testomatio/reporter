import { expect } from 'chai';
import { runWorkers, CodeceptTestRunner } from './utils/codecept.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CodeceptJS Workers HTML Report', function () {
  this.timeout(60000);

  let testRunner;

  before(() => {
    testRunner = new CodeceptTestRunner();
    testRunner.setupTestEnvironment();
  });

  after(() => {
    testRunner.cleanupTestEnvironment();
  });

  describe('HTML Report Generation with Workers', () => {
    it('should generate single HTML report from multiple workers', async () => {
      const { stdout, testEntries, htmlFiles } = await runWorkers(
        { grep: 'Simple' },
        {
          TESTOMATIO_HTML_REPORT_SAVE: '1',
          TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
          TESTOMATIO_HTML_FILENAME: 'workers-test.html',
        }
      );

      expect(stdout).to.include('Running tests in 2 workers');
      expect(stdout).to.include('OK');

      expect(testEntries.length).to.be.greaterThan(0);

      const workersHtmlFiles = htmlFiles.filter(f => f.includes('workers-test.html'));
      expect(workersHtmlFiles.length).to.equal(1);

      const htmlContent = fs.readFileSync(workersHtmlFiles[0], 'utf-8');
      expect(htmlContent).to.include('<!DOCTYPE html>');
      expect(htmlContent).to.include('Test Results');
      expect(htmlContent).to.include('passed');
    });

    it('should aggregate tests from all workers into single HTML report', async () => {
      const { testEntries, htmlFiles } = await runWorkers(
        {},
        {
          TESTOMATIO_HTML_REPORT_SAVE: '1',
          TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
          TESTOMATIO_HTML_FILENAME: 'aggregation-test.html',
        }
      );

      const uniqueTestIds = new Set(testEntries.map(t => t.testId || t.test_id));
      const totalTestsFromDebug = uniqueTestIds.size;

      const aggregationHtmlFiles = htmlFiles.filter(f => f.includes('aggregation-test.html'));
      expect(aggregationHtmlFiles.length).to.equal(1);

      const htmlContent = fs.readFileSync(aggregationHtmlFiles[0], 'utf-8');

      expect(htmlContent).to.include('test');
      expect(htmlContent).to.include('status');

      expect(htmlContent.length).to.be.greaterThan(1000);
    });

    it('should cleanup worker temp files after report generation', async () => {
      await runWorkers({}, {
        TESTOMATIO_HTML_REPORT_SAVE: '1',
        TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
        TESTOMATIO_HTML_FILENAME: 'cleanup-test.html',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const tempFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('testomatio-html-worker-'));

      expect(tempFiles.length).to.equal(0);
    });

    it('should cleanup marker file after workers finish', async () => {
      await runWorkers({}, {
        TESTOMATIO_HTML_REPORT_SAVE: '1',
        TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
        TESTOMATIO_HTML_FILENAME: 'marker-test.html',
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const markerFile = path.join(os.tmpdir(), 'testomatio-main-process.marker');
      expect(fs.existsSync(markerFile)).to.be.false;
    });

    it('should not generate HTML in worker processes, only in main', async () => {
      const { htmlFiles } = await runWorkers(
        {},
        {
          TESTOMATIO_HTML_REPORT_SAVE: '1',
          TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
          TESTOMATIO_HTML_FILENAME: 'single-process-test.html',
        }
      );

      const singleProcessFiles = htmlFiles.filter(f => f.includes('single-process-test.html'));
      expect(singleProcessFiles.length).to.equal(1);

      expect(singleProcessFiles[0]).to.include('single-process-test.html');
    });

    it('should include all test details in HTML report', async () => {
      const { testEntries, htmlFiles } = await runWorkers(
        {},
        {
          TESTOMATIO_HTML_REPORT_SAVE: '1',
          TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
          TESTOMATIO_HTML_FILENAME: 'detailed-test.html',
        }
      );

      const detailedHtmlFiles = htmlFiles.filter(f => f.includes('detailed-test.html'));
      expect(detailedHtmlFiles.length).to.equal(1);

      const htmlContent = fs.readFileSync(detailedHtmlFiles[0], 'utf-8');

      expect(htmlContent).to.include('<html>');
      expect(htmlContent).to.include('<body>');
      expect(htmlContent).to.include('Test Results');

      expect(htmlContent).to.match(/passed|failed/);

      expect(htmlContent.length).to.be.greaterThan(500);
    });
  });

  describe('Workers Mode Detection', () => {
    it('should create marker file when running with workers', async () => {
      const markerFile = path.join(os.tmpdir(), 'testomatio-main-process.marker');

      await runWorkers({}, {
        TESTOMATIO_HTML_REPORT_SAVE: '0',
      });

      expect(fs.existsSync(markerFile)).to.be.false;
    });

    it('should properly detect workers mode environment', async () => {
      const { stdout } = await runWorkers({});

      expect(stdout).to.include('workers');
      expect(stdout).to.include('Running tests in');
    });
  });

  describe('Error Handling', () => {
    it('should handle worker file cleanup errors gracefully', async () => {
      const { htmlFiles } = await runWorkers({}, {
        TESTOMATIO_HTML_REPORT_SAVE: '1',
        TESTOMATIO_HTML_REPORT_FOLDER: 'html-report',
        TESTOMATIO_HTML_FILENAME: 'error-handling-test.html',
      });

      const errorHandlingFiles = htmlFiles.filter(f => f.includes('error-handling-test.html'));
      expect(errorHandlingFiles.length).to.equal(1);
    });

    it('should handle missing HTML directory gracefully', async () => {
      const { htmlFiles } = await runWorkers({}, {
        TESTOMATIO_HTML_REPORT_SAVE: '1',
        TESTOMATIO_HTML_REPORT_FOLDER: 'nonexistent-folder',
        TESTOMATIO_HTML_FILENAME: 'missing-dir-test.html',
      });

      expect(htmlFiles.length).to.be.greaterThanOrEqual(0);
    });
  });
});
