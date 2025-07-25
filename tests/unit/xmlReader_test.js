import path from 'path';
import { expect, assert } from 'chai';
import ServerMock from 'mock-http-server';
import { config } from './adapter/config/index.js';
import { registerHandlers } from './adapter/utils/index.js';
import XmlReader from '../../src/xmlReader.js';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const { host, port, TESTOMATIO_URL, TESTOMATIO, RUN_ID } = config;

describe('XML Reader', () => {
  const server = new ServerMock({ host, port });

  before(done => {
    server.start(() => {
      console.log(`[mock-http-server]: Server started at ${TESTOMATIO_URL}`);

      done();
    });
  });

  after(done => {
    server.stop(() => {
      console.log('[mock-http-server]: Server stopped');

      done();
    });
  });

  it('should parse Jest XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/junit1.xml'));
    expect(jsonData.status).to.eql('failed');
    expect(jsonData.tests_count).to.eql(13);
    expect(jsonData.tests.length).to.eql(jsonData.tests_count);

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });
  });

  it('should parse minitest XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/minitest.xml'));
    expect(jsonData.status).to.eql('passed');

    const stats = reader.calculateStats();
    expect(stats.status).to.eql('passed');
    expect(stats.tests_count).to.eql(10);
    expect(jsonData.tests.length).to.eql(stats.tests_count);

    reader.fetchSourceCode();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    expect(jsonData.tests[0].code).to.be.ok;
    expect(jsonData.tests[0].code).to.include("test 'should ");
  });

  it('should parse Pytest XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/pytest.xml'));

    expect(jsonData.status).to.eql('failed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed');
    expect(stats.tests_count).to.eql(7);
    expect(jsonData.tests.length).to.eql(stats.tests_count);

    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    expect(jsonData.tests[0].title).to.eql('Login With Valid Credentials');

    const failedTests = jsonData.tests.filter(t => t.status === 'failed');
  });

  it('should parse Codeception XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/codecept.xml'));

    expect(jsonData.status).to.eql('failed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed');
    expect(stats.tests_count).to.eql(89);
    expect(jsonData.tests.length).to.eql(stats.tests_count);

    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    expect(jsonData.tests[0].code).to.be.ok;
    expect(jsonData.tests[0].code).to.include('public function runCestWithTwoFailedTest(');
    expect(jsonData.tests[0].title).to.eql('Run Cest With Two Failed Test');

    const failedTests = jsonData.tests.filter(t => t.status === 'failed');
    const failedTest = failedTests[0];
    expect(failedTest.stack).to.include('public function');
  });

  it('should parse simple JUnit XML', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(dirname, 'data/junit_simple.xml'));

    expect(jsonData.status).to.eql('failed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed');
    expect(stats.tests_count).to.eql(1);

    reader.formatErrors();
    reader.formatTests();

    const test = jsonData.tests[0];
    expect(test.file).to.eql('tests/LoginTest.java');
    expect(test.title).to.eql('Login');
    expect(test.test_id).to.eql('8acca9eb');
  });

  it('should parse JUnit XML', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(dirname, 'data/java.xml'));

    expect(jsonData.status).to.eql('failed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed');
    expect(stats.tests_count).to.eql(6);
    expect(jsonData.tests.length).to.eql(stats.tests_count);

    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    // expect(jsonData.tests[0].code).to.be.ok;
    // expect(jsonData.tests[0].code).to.include("public function runCestWithTwoFailedTest(")
    // expect(jsonData.tests[0].title).to.eql("Run cest with two failed test")

    const failedTests = jsonData.tests.filter(t => t.status === 'failed');
    const failedTest = failedTests[0];
    console.log(failedTest.stack);
    expect(failedTest.stack).to.include('(CalculatorTest.java:43');
  });

  it('should parse Selenide JUnit XML', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(dirname, 'data/selenide.xml'));

    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    const failedTests = jsonData.tests.filter(t => t.status === 'failed');
    const failedTest = failedTests[0];
    console.log(failedTest.stack);
    expect(failedTest.stack).to.include('SUITE-BEFORE');
    expect(failedTest.stack).to.include('SUITE ERR');
  });

  it('should parse JUnit XML and skipped tests', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/junit_skipped.xml'));

    expect(jsonData.status).to.eql('failed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed');
    expect(stats.tests_count).to.eql(2);

    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    const skippedTests = jsonData.tests.filter(t => t.status === 'skipped');
    expect(skippedTests.length).to.eql(1);
    const skippedTest = skippedTests[0];
    expect(skippedTest.title).to.eql('Check Dashboard');
  });

  it('should parse JUnit params', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(dirname, 'data/junit2.xml'));

    expect(jsonData.status).to.eql('passed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('passed');
    expect(stats.tests_count).to.eql(4);

    reader.connectAdapter();
    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t.title).to.eql('Can Create API Key ${param}');
      expect(t).to.contain.keys(['stack', 'create', 'status', 'file', 'title', 'run_time', 'suite_title']);
    });

    expect(jsonData.tests[0].example.param).to.eql('Master');
  });

  it('should parse JUnit params as suiteId', () => {
    const reader = new XmlReader({ lang: 'java' });
    reader.parse(path.join(dirname, 'data/junit3.xml'));
    reader.formatTests();

    expect(reader.tests[0].title).to.include(' @St1234567');
  });

  it('should parse JUnit C#', () => {
    const reader = new XmlReader({ lang: 'c#' });
    reader.connectAdapter();
    const jsonData = reader.parse(path.join(dirname, 'data/csharp.xml'));

    expect(jsonData.status).to.eql('failed');
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed');
    expect(stats.tests_count).to.eql(3);
    expect(jsonData.tests.length).to.eql(stats.tests_count);

    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });

    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Create a Web Lead');
    expect(tests[0].suite_title).to.include('User');
  });

  it('should parse TIDs from JUnit C#', () => {
    const reader = new XmlReader({ lang: 'c#' });
    reader.connectAdapter();
    const jsonData = reader.parse(path.join(dirname, 'data/csharp_tid.xml'));
    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    expect(jsonData.tests[0].test_id).to.eql('12345678');
    expect(jsonData.tests[1].test_id).to.eql('a0b1c2d3');
  });

  it('should parse C# JUnit XML with skipped tests', () => {
    const reader = new XmlReader({ lang: 'c#' });
    const jsonData = reader.parse(path.join(dirname, 'data/csharp_skipped.xml'));

    expect(jsonData.status).to.eql('passed');
    expect(jsonData.tests_count).to.eql(2);
    expect(jsonData.tests.length).to.eql(2);

    reader.formatTests();

    // Verify test statuses
    const tests = jsonData.tests;
    expect(tests[0].status).to.eql('skipped');
    expect(tests[1].status).to.eql('passed');

    // Verify test titles
    expect(tests[0].title).to.eql('Verify Service Started');
    expect(tests[1].title).to.eql('Verify Changes In Service Saved');

    expect(tests[0].file).to.eql('E2E/Tests/Payment/UserScenarios.cs');
    // Verify suite titles
    expect(tests[0].suite_title).to.eql('UserScenarios');
    expect(tests[1].suite_title).to.eql('UserScenarios');

    // Verify tags/categories
    expect(tests[0].tags).to.include('Payment');
    expect(tests[0].tags).to.include('T00000076');
    expect(tests[1].tags).to.include('Payment');
    expect(tests[1].tags).to.include('T000000be');

    // Verify test IDs
    expect(tests[1].test_id).to.eql('575eb8be');
  });

  it('should parse C# JUnit XML with test IDs', () => {
    const reader = new XmlReader({ lang: 'c#' });
    reader.connectAdapter();
    const jsonData = reader.parse(path.join(dirname, 'data/csharp_id.xml'));
    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    expect(jsonData.tests[0].test_id).to.eql('00000076');
  });

  it('should parse NUnit TRX XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/nunit.xml'));

    expect(jsonData.status).to.eql('passed');
    expect(jsonData.tests_count).to.eql(2);
    expect(jsonData.tests.length).to.eql(2);

    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });

    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Create User Login');
    expect(tests[0].suite_title).to.include('User');
  });

  it('should parse NUnit3 XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/nunit3.xml'));

    expect(jsonData.status).to.eql('failed');
    expect(jsonData.tests_count).to.eql(3);
    expect(jsonData.tests.length).to.eql(3);

    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });

    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Update User');
    expect(tests[0].suite_title).to.include('User');
  });

  it('should parse XUnit XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/xunit.xml'));

    expect(jsonData.status).to.eql('failed');
    expect(jsonData.tests_count).to.eql(6);
    expect(jsonData.tests.length).to.eql(6);

    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });

    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Method1');
    expect(tests[0].suite_title).to.include('TestClass1');
    expect(tests[0].file).to.eql('Sample/Tests');
    expect(tests[0].status).to.eql('passed');
  });

  it('should parse XUnit2 client XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/xunit2.xml'));

    expect(jsonData.status).to.eql('passed');
    expect(jsonData.tests_count).to.eql(1);
    expect(jsonData.tests.length).to.eql(1);

    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });

    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Test');
    expect(tests[0].suite_title).to.include('Class1');
    expect(tests[0].file).to.eql('ConsoleApp2');
  });

  it('should parse XUnit with SpecFlow', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(dirname, 'data/specflow.xml'));

    expect(jsonData.status).to.eql('passed');
    expect(jsonData.tests_count).to.eql(7);
    expect(jsonData.tests.length).to.eql(7);

    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys(['stack', 'create', 'status', 'title', 'run_time', 'suite_title']);
    });

    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Allow Mobile Print Behavior');
    expect(tests[0].suite_title).to.include('ApiFeature');
  });

  describe('#request', () => {
    before(function () {
      this.timeout(5000);
    });

    beforeEach(() => {
      registerHandlers(server, RUN_ID);
    });

    it('should create a new run Id', async () => {
      const reader = new XmlReader({
        testomatioUrl: TESTOMATIO_URL,
        apiKey: TESTOMATIO,
      });
      reader.parse(path.join(dirname, 'data/junit1.xml'));
      await reader.createRun();

      const [req] = server.requests({ method: 'POST', path: '/api/reporter' });
      const expectedResult = { api_key: TESTOMATIO };
      assert.isObject(req.body);
      expect(req.body).to.include(expectedResult);
    });

    it('should publish updates', async () => {
      const reader = new XmlReader({
        testomatioUrl: TESTOMATIO_URL,
        apiKey: TESTOMATIO,
        runId: RUN_ID,
      });
      reader.parse(path.join(dirname, 'data/junit1.xml'));

      await reader.createRun();
      const [req] = server.requests({ method: 'PUT', path: '/api/reporter/' + RUN_ID });
      assert.isObject(req.body);
    });

    afterEach(() => {
      server.reset();
    });
  });
});
