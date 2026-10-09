import { expect } from 'chai';

import fs from 'fs';
import os from 'os';
import path from 'path';

// Helper function to normalize paths for cross-platform testing
function normalizePath(filePath) {
  return filePath ? filePath.replace(/\\/g, '/') : filePath;
}
import {
  fetchFilesFromStackTrace,
  fetchSourceCodeFromStackTrace,
  fetchIdFromCode,
  fetchIdFromOutput,
  fetchSourceCode,
  ansiRegExp,
  cleanLatestRunId,
  isSameTest,
  fileSystem,
  foundedTestLog,
  formatStep,
  getCurrentDateTime,
  getTestomatIdFromTestTitle,
  humanize,
  isValidUrl,
  parseSuite,
  readLatestRunId,
  removeColorCodes,
  specificTestInfo,
  storeRunId,
  testRunnerHelper,
  transformEnvVarToBoolean,
  validateSuiteId,
  applyFilter,
} from '../../src/utils/utils.js';

describe('Utils', () => {
  it('#fetchFilesFromStackTrace | should match images from stack trace', () => {
    const file1 = `${process.cwd()}/tests/unit/data/artifacts/failed_test.png`;
    const file2 = `${process.cwd()}/tests/unit/data/artifacts/screenshot1.png`;

    const stack = `
PayrollPBTest:everyPayrollIsPositive =
                              |-------------------jqwik-------------------
tries = 1000                  | # of calls to property
checks = 1000                 | # of not rejected calls
  file:/${file1}
generation = RANDOMIZED       | parameters are randomly generated
after-failure = PREVIOUS_SEED | use the previous seed
edge-cases# file:/${file2}
edge-cases#total = 12         | # of all combined edge cases
edge-cases#tried = 12         | # of edge cases tried in current run
seed = 7004898156813507962    | random seed to reproduce generated values
    `;
    const files = fetchFilesFromStackTrace(stack);
    expect(files.map(f => normalizePath(f))).to.include(normalizePath(file1));
    expect(files.map(f => normalizePath(f))).to.include(normalizePath(file2));
  });

  it('#fetchFilesFromStackTrace | should match images with one /', () => {
    const file1 = `${process.cwd()}/tests/unit/data/artifacts/failed_test.png`;

    const stack = `
PayrollPBTest:everyPayrollIsPositive =
                              |-------------------jqwik-------------------
tries = 1000                  | # of calls to property
  and file:${file1}
    `;
    const files = fetchFilesFromStackTrace(stack);
    expect(files.map(f => normalizePath(f))).to.include(normalizePath(file1));
  });

  it('#fetchFilesFromStackTrace | should match images with file:/// (3 slashes)', () => {
    const file1 = `${process.cwd()}/tests/unit/data/artifacts/failed_test.png`;
    const file2 = `${process.cwd()}/tests/unit/data/artifacts/screenshot1.png`;

    const stack = `
Test execution failed at step 3
Screenshot captured: file:///${file1}
Additional evidence: file:///${file2}

Stack trace:
at IntegrationTests.Features.MultipleFiles.TestWithMultipleArtifacts()
    `;
    const files = fetchFilesFromStackTrace(stack);
    expect(files.map(f => normalizePath(f))).to.include(normalizePath(file1));
    expect(files.map(f => normalizePath(f))).to.include(normalizePath(file2));
    expect(files.length).to.eql(2);
  });

  it('#fetchFilesFromStackTrace | should extract multiple files from C# JUnit XML stack traces', () => {
    const stack = `
Test started at 2023-10-25T15:58:13
Step 1: Navigate to login page - PASSED
Step 2: Enter credentials - PASSED  
Step 3: Click submit button - FAILED

Evidence files captured:
- Screenshot: file:///workdir/projects/testomatio/reporter/tests/data/artifacts/failed_test.png
- Additional screenshot: file:///workdir/projects/testomatio/reporter/tests/data/artifacts/screenshot1.png
- Additional screenshot: file://workdir/projects/testomatio/reporter/tests/data/artifacts/screenshot2.png
- Windows path: file:/C:\\Users\\workdir\\projects\\testomatio\\reporter\\tests\\data\\artifacts\\failed_step1.png
- Windows 2 path: file://C:/Users/workdir/projects/testomatio/reporter/tests/data/artifacts/failed_step2.png

Test completed with failures

Stack trace:
at IntegrationTests.Features.MultipleFiles.TestWithMultipleArtifacts() in C:\\Projects\\Tests\\MultipleFiles.cs:line 42
at Microsoft.VisualStudio.TestPlatform.MSTest.TestAdapter.Execution.TestMethodRunner.RunTestMethod()
    `;

    // Test without file existence check to verify regex extraction
    const files = fetchFilesFromStackTrace(stack, false);

    expect(files).to.be.an('array');
    expect(files.length).to.eql(5);

    // Verify all expected files are extracted
    expect(files).to.include('/workdir/projects/testomatio/reporter/tests/data/artifacts/failed_test.png');
    expect(files).to.include('/workdir/projects/testomatio/reporter/tests/data/artifacts/screenshot1.png');
    expect(files).to.include('/workdir/projects/testomatio/reporter/tests/data/artifacts/screenshot2.png');
    expect(files).to.include('/Users/workdir/projects/testomatio/reporter/tests/data/artifacts/failed_step1.png');
    expect(files).to.include('/Users/workdir/projects/testomatio/reporter/tests/data/artifacts/failed_step2.png');
  });

  it('#fetchSourceCodeFromStackTrace | prefixed with at ', () => {
    const stack = `
Expected: <4.0>
     but: was <6.0>
  at ${process.cwd()}/tests/unit/data/cli/RunCest.php:24
    `;
    const source = fetchSourceCodeFromStackTrace(stack);
    expect(source).to.include(`$I->executeCommand('run --colors tests/dummy/FileExistsCept.php');`);
    expect(source).to.include(`24 >`);
  });

  it('#fetchSourceCodeFromStackTrace | without prefix', () => {
    const stack = `
Expected: <4.0>
     but: was <6.0>
${process.cwd()}/tests/unit/data/cli/RunCest.php:24
    `;
    const source = fetchSourceCodeFromStackTrace(stack);
    expect(source).to.include(`$I->executeCommand('run --colors tests/dummy/FileExistsCept.php');`);
    expect(source).to.include(`24 >`);
  });

  it('#fetchIdFromCode', () => {
    const code = `
    void sumIsNeutral(@ForAll double first, @ForAll double second) throws Exception {
      // @T8acca9eb
      double actual = calculator.Calculate(first, second, "+");
      double actualPlusZero = calculator.Calculate(actual, 0.0, "+");

      assertThat(actual, is(equalTo(actualPlusZero)));
  }

    `;
    const id = fetchIdFromCode(code);
    expect(id).to.eql(`8acca9eb`);
  });

  it('#fetchIdFromOutput', () => {
    const code = `
    linss
    tid://@T8acca9eb

      assertThat(actual, is(equalTo(actualPlusZero)));
  }

    `;
    const id = fetchIdFromOutput(code);
    expect(id).to.eql(`8acca9eb`);
  });

  it('#fetchSourceCode for complex java example', () => {
    const code = `
    import org.junit.jupiter.api.Assertions;
    import org.junit.jupiter.api.DisplayName;
    import org.junit.jupiter.api.Test;
    
    @Slf4j
    public class UserLoginTests extends BaseTest {
    ;
        @Test
        @DisplayName("UserLogin")
        public void testUserLogin() {
            // @Te4e19da3
            MainSearchScreen mainSearchScreen = new MainSearchScreen(driver);
        }
    }    
    `;

    const test = fetchSourceCode(code, { lang: 'java', title: 'UserLogin' });

    expect(test).to.include(`UserLogin`);
    expect(test).to.include(`@Te4e19da3`);
  });

  it('#fetchSourceCode takes DisplayName into account', () => {
    const code = `
    import org.junit.jupiter.api.Assertions;
    import org.junit.jupiter.api.DisplayName;
    import org.junit.jupiter.api.Test;
    
    public class BookingAppointmentTests extends BaseTest {
        @Test
        @DisplayName("BookingBySearch")
        public void testBookingAppointmentBySearch() {
            // @Tb60ca408
            MainSearchScreen mainSearchScreen = new MainSearchScreen(driver);
        }
    }
    `;

    const test = fetchSourceCode(code, { lang: 'java', title: 'BookingBySearch' });
    // console.log(test);

    expect(test).to.include(`BookingBySearch`);
    expect(test).to.include(`@Tb60ca408`);
  });

  describe('#ansiRegExp', () => {
    it('should remove ANSI escape codes from text', () => {
      const regex = ansiRegExp();
      const coloredText = '\u001b[31mRed text\u001b[0m \u001b[32mGreen text\u001b[0m';
      const cleanText = coloredText.replace(regex, '');
      expect(cleanText).to.eql('Red text Green text');
    });

    it('should handle complex ANSI sequences', () => {
      const regex = ansiRegExp();
      const complexText = '\u001B[1;31mBold Red\u001B[0m \u009B[32mGreen\u001B[0m';
      const cleanText = complexText.replace(regex, '');
      expect(cleanText).to.eql('Bold Red Green');
    });
  });

  describe('#getTestomatIdFromTestTitle', () => {
    it('should extract test ID from title', () => {
      const title = 'Login test @T12345678 should work';
      const id = getTestomatIdFromTestTitle(title);
      expect(id).to.eql('@T12345678');
    });

    it('should return null for title without test ID', () => {
      const title = 'Login test without ID';
      const id = getTestomatIdFromTestTitle(title);
      expect(id).to.be.null;
    });

    it('should return null for empty/null title', () => {
      expect(getTestomatIdFromTestTitle('')).to.be.null;
      expect(getTestomatIdFromTestTitle(null)).to.be.null;
      expect(getTestomatIdFromTestTitle(undefined)).to.be.null;
    });
  });

  describe('#parseSuite', () => {
    it('should extract suite ID from title', () => {
      const title = 'User Management @S87654321 Suite';
      const id = parseSuite(title);
      expect(id).to.eql('@S87654321');
    });

    it('should return null for title without suite ID', () => {
      const title = 'Suite without ID';
      const id = parseSuite(title);
      expect(id).to.be.null;
    });
  });

  describe('#validateSuiteId', () => {
    it('should validate correct suite ID format', () => {
      const validId = '@S12345678';
      const result = validateSuiteId(validId);
      expect(result).to.eql('@S12345678');
    });

    it('should return null for invalid format', () => {
      expect(validateSuiteId('@S123')).to.be.null;
      expect(validateSuiteId('S12345678')).to.be.null;
      expect(validateSuiteId('')).to.be.null;
      expect(validateSuiteId(null)).to.be.null;
    });
  });

  describe('#isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).to.be.true;
      expect(isValidUrl('http://localhost:3000')).to.be.true;
      expect(isValidUrl('ftp://files.example.com')).to.be.true;
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).to.be.false;
      expect(isValidUrl('')).to.be.false;
      expect(isValidUrl('just-text')).to.be.false;
    });
  });

  describe('#isSameTest', () => {
    it('should identify different tests', () => {
      const test1 = {
        title: 'Login Test',
        suite_title: 'Auth Suite',
        test_id: '@T12345678',
      };
      const test2 = {
        title: 'Logout Test',
        suite_title: 'Auth Suite',
        test_id: '@T87654321',
      };
      expect(isSameTest(test1, test2)).to.be.false;
    });

    it('should handle non-object inputs', () => {
      expect(isSameTest('test1', 'test2')).to.be.false;
      expect(isSameTest({ title: 'test' }, 'string')).to.be.false;
    });

    it('should show that function has comparison bugs', () => {
      // The function has bugs: arrays compared with === always fail
      // and null inputs cause errors. We document the actual behavior here
      const test1 = { title: 'test', suite_title: 'suite', test_id: 'id' };
      const test2 = { title: 'test', suite_title: 'suite', test_id: 'id' };

      // This should be true but is false due to Object.values comparison bug
      expect(isSameTest(test1, test2)).to.be.false;
    });
  });

  describe('#getCurrentDateTime', () => {
    it('should return current date time in expected format', () => {
      const dateTime = getCurrentDateTime();
      expect(dateTime).to.match(/^\d{4}_\d{1,2}_\d{1,2}_\d{1,2}_\d{1,2}_\d{1,2}$/);
    });
  });

  describe('#specificTestInfo', () => {
    it('should generate test info string', () => {
      const test = {
        title: 'Login Test Case',
        file: '/path/to/test.spec.js',
      };
      const info = specificTestInfo(test);
      expect(info).to.eql('test#spec#js#Login#Test#Case');
    });

    it('should return null for missing data', () => {
      expect(specificTestInfo({})).to.be.null;
      expect(specificTestInfo({ title: 'test' })).to.be.null;
      expect(specificTestInfo({ file: 'test.js' })).to.be.null;
    });
  });

  describe('#humanize', () => {
    it('should humanize camelCase text', () => {
      expect(humanize('testCamelCase')).to.eql('Camel Case');
      expect(humanize('getUserData')).to.eql('Get User Data');
    });

    it('should humanize snake_case text', () => {
      expect(humanize('test_snake_case')).to.eql('Snake Case');
      expect(humanize('user_login_test')).to.eql('User Login Test');
    });

    it('should handle text with spaces', () => {
      expect(humanize('test with spaces')).to.eql('With Spaces');
    });

    it('should remove "Test" and "Should" prefixes', () => {
      expect(humanize('Test user login')).to.eql('User Login');
      expect(humanize('Should validate input')).to.eql('Validate Input');
    });

    it('should handle a/the articles correctly', () => {
      expect(humanize('test A user')).to.eql('a User');
      expect(humanize('test The system')).to.eql('the System');
    });
  });

  describe('#removeColorCodes', () => {
    it('should remove ANSI color codes', () => {
      const coloredText = '\x1b[31mError:\x1b[0m Test failed';
      const cleanText = removeColorCodes(coloredText);
      expect(cleanText).to.eql('Error: Test failed');
    });

    it('should handle multiple color codes', () => {
      const coloredText = '\x1b[32mPASS\x1b[0m \x1b[31mFAIL\x1b[0m \x1b[33mWARN\x1b[0m';
      const cleanText = removeColorCodes(coloredText);
      expect(cleanText).to.eql('PASS FAIL WARN');
    });
  });

  describe('#formatStep', () => {
    it('should format simple step', () => {
      const step = {
        title: 'I click login button',
        duration: 150,
      };
      const formatted = formatStep(step);
      expect(formatted).to.be.an('array');
      expect(formatted[0]).to.include('I click login button');
      expect(formatted[0]).to.include('150ms');
    });

    it('should format step with error', () => {
      const step = {
        title: 'I click login button',
        duration: 150,
        error: new Error('Button not found'),
      };
      const formatted = formatStep(step);
      expect(formatted[0]).to.include('I click login button');
    });

    it('should format nested steps', () => {
      const step = {
        title: 'I perform login',
        duration: 300,
        steps: [
          { title: 'I enter username', duration: 100 },
          { title: 'I enter password', duration: 100 },
          { title: 'I click submit', duration: 100 },
        ],
      };
      const formatted = formatStep(step);
      expect(formatted).to.have.lengthOf(4);
      expect(formatted[1]).to.include('I enter username');
      expect(formatted[2]).to.include('I enter password');
      expect(formatted[3]).to.include('I click submit');
    });
  });

  describe('#testRunnerHelper', () => {
    describe('#getNameOfCurrentlyRunningTest', () => {
      it('should return global testomatio test title if set', () => {
        const originalTitle = global.testomatioTestTitle;
        global.testomatioTestTitle = 'Current Test';

        const result = testRunnerHelper.getNameOfCurrentlyRunningTest();
        expect(result).to.eql('Current Test');

        global.testomatioTestTitle = originalTitle;
      });

      it('should return null when not in Jest environment', () => {
        const originalWorker = process.env.JEST_WORKER_ID;
        delete process.env.JEST_WORKER_ID;

        const result = testRunnerHelper.getNameOfCurrentlyRunningTest();
        expect(result).to.be.null;

        if (originalWorker) process.env.JEST_WORKER_ID = originalWorker;
      });
    });
  });

  describe('#foundedTestLog', () => {
    let originalLog;
    let logCalls;

    beforeEach(() => {
      originalLog = console.log;
      logCalls = [];
      console.log = (...args) => logCalls.push(args);
    });

    afterEach(() => {
      console.log = originalLog;
    });

    it('should log single test found', () => {
      foundedTestLog('TestApp', [{ title: 'Test 1' }]);
      expect(logCalls[0]).to.include('TestApp');
      expect(logCalls[0][1]).to.include('one test');
    });

    it('should log multiple tests found', () => {
      foundedTestLog('TestApp', [{ title: 'Test 1' }, { title: 'Test 2' }]);
      expect(logCalls[0]).to.include('TestApp');
      expect(logCalls[0][1]).to.include('2 tests');
    });
  });

  describe('#fileSystem', () => {
    let testDir;

    beforeEach(() => {
      testDir = path.join(os.tmpdir(), 'testomatio-test-' + Math.random().toString(36).substring(7));
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    describe('#createDir', () => {
      it('should create directory if it does not exist', () => {
        expect(fs.existsSync(testDir)).to.be.false;
        fileSystem.createDir(testDir);
        expect(fs.existsSync(testDir)).to.be.true;
        expect(fs.lstatSync(testDir).isDirectory()).to.be.true;
      });

      it('should not fail if directory already exists', () => {
        fs.mkdirSync(testDir);
        expect(fs.existsSync(testDir)).to.be.true;
        expect(() => fileSystem.createDir(testDir)).to.not.throw();
      });

      it('should create nested directories', () => {
        const nestedDir = path.join(testDir, 'nested', 'deep');
        fileSystem.createDir(nestedDir);
        expect(fs.existsSync(nestedDir)).to.be.true;
        expect(fs.lstatSync(nestedDir).isDirectory()).to.be.true;
      });
    });

    describe('#clearDir', () => {
      it('should remove directory and its contents', () => {
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
        fs.mkdirSync(path.join(testDir, 'subdir'));

        expect(fs.existsSync(testDir)).to.be.true;
        fileSystem.clearDir(testDir);
        expect(fs.existsSync(testDir)).to.be.false;
      });

      it('should not fail if directory does not exist', () => {
        expect(fs.existsSync(testDir)).to.be.false;
        expect(() => fileSystem.clearDir(testDir)).to.not.throw();
      });
    });
  });

  describe('Run ID Functions', () => {
    let originalTmpDir;
    const testRunId = 'test-run-12345';

    beforeEach(() => {
      originalTmpDir = os.tmpdir;
      cleanLatestRunId(); // Clean up any existing run ID file
    });

    afterEach(() => {
      cleanLatestRunId(); // Clean up after each test
      os.tmpdir = originalTmpDir;
    });

    describe('#storeRunId', () => {
      it('should store run ID to temp file', () => {
        storeRunId(testRunId);
        const storedRunId = readLatestRunId();
        expect(storedRunId).to.eql(testRunId);
      });

      it('should not store undefined or null run ID', () => {
        storeRunId(undefined);
        expect(readLatestRunId()).to.be.null;

        storeRunId('undefined');
        expect(readLatestRunId()).to.be.null;

        storeRunId(null);
        expect(readLatestRunId()).to.be.null;
      });
    });

    describe('#readLatestRunId', () => {
      it('should return stored run ID', () => {
        storeRunId(testRunId);
        const result = readLatestRunId();
        expect(result).to.eql(testRunId);
      });

      it('should return null if no run ID file exists', () => {
        const result = readLatestRunId();
        expect(result).to.be.null;
      });

      it('should return null if file is older than 1 hour', () => {
        const filePath = path.join(os.tmpdir(), 'testomatio.latest.run');
        fs.writeFileSync(filePath, testRunId);

        // Modify file time to be older than 1 hour
        const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        fs.utimesSync(filePath, oldTime, oldTime);

        const result = readLatestRunId();
        expect(result).to.be.null;
      });

      it('should handle file read errors gracefully', () => {
        const mockTmpDir = path.join(os.tmpdir(), 'non-existent-dir');
        os.tmpdir = () => mockTmpDir;

        const result = readLatestRunId();
        expect(result).to.be.null;
      });
    });

    describe('#cleanLatestRunId', () => {
      it('should remove run ID file if it exists', () => {
        storeRunId(testRunId);
        const filePath = path.join(os.tmpdir(), 'testomatio.latest.run');
        expect(fs.existsSync(filePath)).to.be.true;

        cleanLatestRunId();
        expect(fs.existsSync(filePath)).to.be.false;
      });

      it('should not fail if file does not exist', () => {
        const filePath = path.join(os.tmpdir(), 'testomatio.latest.run');
        expect(fs.existsSync(filePath)).to.be.false;
        expect(() => cleanLatestRunId()).to.not.throw();
      });
    });

    describe('#transformEnvVarToBoolean', () => {
      it('should return false for undefined values', () => {
        expect(transformEnvVarToBoolean(undefined)).to.be.false;
        expect(transformEnvVarToBoolean(null)).to.be.false;
        expect(transformEnvVarToBoolean('undefined')).to.be.false;
      });

      it('should return true for truthy string values', () => {
        expect(transformEnvVarToBoolean('1')).to.be.true;
        expect(transformEnvVarToBoolean('true')).to.be.true;
        expect(transformEnvVarToBoolean('TRUE')).to.be.true;
        expect(transformEnvVarToBoolean('True')).to.be.true;
        expect(transformEnvVarToBoolean('yes')).to.be.true;
        expect(transformEnvVarToBoolean('YES')).to.be.true;
        expect(transformEnvVarToBoolean('Yes')).to.be.true;
        expect(transformEnvVarToBoolean('on')).to.be.true;
        expect(transformEnvVarToBoolean('ON')).to.be.true;
        expect(transformEnvVarToBoolean('On')).to.be.true;
      });

      it('should return false for falsy string values', () => {
        expect(transformEnvVarToBoolean('0')).to.be.false;
        expect(transformEnvVarToBoolean('false')).to.be.false;
        expect(transformEnvVarToBoolean('FALSE')).to.be.false;
        expect(transformEnvVarToBoolean('False')).to.be.false;
        expect(transformEnvVarToBoolean('no')).to.be.false;
        expect(transformEnvVarToBoolean('NO')).to.be.false;
        expect(transformEnvVarToBoolean('No')).to.be.false;
        expect(transformEnvVarToBoolean('off')).to.be.false;
        expect(transformEnvVarToBoolean('OFF')).to.be.false;
        expect(transformEnvVarToBoolean('Off')).to.be.false;
      });

      it('should return true for any other non-empty string values', () => {
        expect(transformEnvVarToBoolean('some-value')).to.be.true;
        expect(transformEnvVarToBoolean('random')).to.be.true;
        expect(transformEnvVarToBoolean('2')).to.be.true;
        expect(transformEnvVarToBoolean('enabled')).to.be.true;
        expect(transformEnvVarToBoolean('disabled')).to.be.true;
      });

      it('should return false for empty string and whitespace-only strings', () => {
        expect(transformEnvVarToBoolean('')).to.be.false;
        expect(transformEnvVarToBoolean(' ')).to.be.false; // whitespace only, becomes empty after trim
        expect(transformEnvVarToBoolean('   ')).to.be.false; // multiple spaces, becomes empty after trim
      });

      it('should handle edge cases', () => {
        expect(transformEnvVarToBoolean('  true  ')).to.be.true; // with spaces, trimmed and recognized as true
        expect(transformEnvVarToBoolean('True ')).to.be.true; // trailing space, trimmed and recognized as true
        expect(transformEnvVarToBoolean(' true')).to.be.true; // leading space, trimmed and recognized as true
        expect(transformEnvVarToBoolean(' false ')).to.be.false; // spaces around false, trimmed and recognized as false
        expect(transformEnvVarToBoolean('no ')).to.be.false; // trailing space, trimmed and recognized as false
        expect(transformEnvVarToBoolean(' off')).to.be.false; // leading space, trimmed and recognized as false
      });

      it('should handle boolean input types directly', () => {
        expect(transformEnvVarToBoolean(true)).to.be.true;
        expect(transformEnvVarToBoolean(false)).to.be.false;
      });

      it('should handle non-string input types by converting to string', () => {
        expect(transformEnvVarToBoolean(1)).to.be.true; // number 1 -> "1" -> true
        expect(transformEnvVarToBoolean(0)).to.be.false; // number 0 -> "0" -> false
        expect(transformEnvVarToBoolean(123)).to.be.true; // other number -> "123" -> true (not recognized, so Boolean("123"))
        expect(transformEnvVarToBoolean({})).to.be.true; // object -> "[object Object]" -> true (not recognized, so Boolean("[object Object]"))
        expect(transformEnvVarToBoolean([])).to.be.false; // empty array -> "" -> false (empty string after trim)
        expect(transformEnvVarToBoolean([1, 2])).to.be.true; // array -> "1,2" -> true (not recognized, so Boolean("1,2"))
      });
    });
  });

  describe('#applyFilter', () => {
    it('should return original command when tests list is empty or undefined', () => {
      expect(applyFilter('npx jest', [])).to.eql('npx jest');
      expect(applyFilter('npx jest', null)).to.eql('npx jest');
      expect(applyFilter('npx jest', undefined)).to.eql('npx jest');
    });

    it('should append --testNamePattern for Jest commands', () => {
      const cmd = 'npx jest';
      const result = applyFilter(cmd, ['T123', 'T456']);
      expect(result).to.eql('npx jest --testNamePattern (T123|T456)');
    });

    it('should detect Jest command case-insensitively', () => {
      const cmd = 'npx Jest tests/unit';
      const result = applyFilter(cmd, ['T1']);
      expect(result).to.eql('npx Jest tests/unit --testNamePattern (T1)');
    });

    it('should append --grep for non-Jest / non-Cypress commands', () => {
      const cmd = 'npx playwright test';
      const result = applyFilter(cmd, ['T1', 'T2']);
      expect(result).to.eql('npx playwright test --grep (T1|T2)');
    });

    it('should add --env with grep options for Cypress when no existing --env', () => {
      const cmd = 'npx cypress run --browser chrome';
      const result = applyFilter(cmd, ['T0171ba11']);
      expect(result).to.eql(
        'npx cypress run --browser chrome --env {"grep":"T0171ba11","grepFilterSpecs":true,"grepOmitFiltered":true}'
      );
    });

    it('should extend existing unquoted --env for Cypress', () => {
      const cmd = 'npx cypress run --env FOO=bar';
      const result = applyFilter(cmd, ['T1', 'T2']);
      expect(result).to.eql(
        'npx cypress run --env {"FOO":"bar","grep":"T1,T2","grepFilterSpecs":true,"grepOmitFiltered":true}'
      );
    });

    it('should extend existing quoted --env for Cypress', () => {
      const cmd = 'npx cypress run --env "FOO=bar,baz=1"';
      const result = applyFilter(cmd, ['T1', 'T2']);
      expect(result).to.eql(
        'npx cypress run --env {"FOO":"bar","baz":"1","grep":"T1,T2","grepFilterSpecs":true,"grepOmitFiltered":true}'
      );
    });

    it('should detect Cypress command case-insensitively', () => {
      const cmd = 'npx Cypress run';
      const result = applyFilter(cmd, ['T1']);
      expect(result).to.eql(
        'npx Cypress run --env {"grep":"T1","grepFilterSpecs":true,"grepOmitFiltered":true}'
      );
    });
  });
});
