const path = require('path');
const { expect, assert } = require('chai');
const ServerMock = require('mock-http-server');
const { host, port, TESTOMATIO_URL, TESTOMATIO, RUN_ID } = require('./adapter/config');
const { registerHandlers } = require('./adapter/utils');
const XmlReader = require('../lib/xmlReader')

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
    const jsonData = reader.parse(path.join(__dirname, 'data/junit1.xml'))
    expect(jsonData.status).to.eql('failed')
    expect(jsonData.tests_count).to.eql(13)
    expect(jsonData.tests.length).to.eql(jsonData.tests_count)
    
    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys([
        'stack',
        'create',
        'status',
        'title',
        'run_time',
        'suite_title',
      ])  
    })
  })


  it('should parse minitest XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/minitest.xml'))
    expect(jsonData.status).to.eql('passed')
    
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('passed')
    expect(stats.tests_count).to.eql(10)
    expect(jsonData.tests.length).to.eql(stats.tests_count)

    reader.fetchSourceCode();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys([
        'stack',
        'create',
        'status',
        'file',
        'title',
        'run_time',
        'suite_title',
      ])  
    })

    expect(jsonData.tests[0].code).to.be.ok;
    expect(jsonData.tests[0].code).to.include("test 'should ")
  })  

  it('should parse Pytest XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/pytest.xml'))

    expect(jsonData.status).to.eql('failed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed')
    expect(stats.tests_count).to.eql(7)
    expect(jsonData.tests.length).to.eql(stats.tests_count)


    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys([
        'stack',
        'create',
        'status',
        'file',
        'title',
        'run_time',
        'suite_title',
      ])
    })

    expect(jsonData.tests[0].title).to.eql("login with valid credentials")

    const failedTests = jsonData.tests.filter(t => t.status === 'failed')
  })

  it('should parse Codeception XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/codecept.xml'))

    expect(jsonData.status).to.eql('failed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed')
    expect(stats.tests_count).to.eql(89)
    expect(jsonData.tests.length).to.eql(stats.tests_count)
    

    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys([
        'stack',
        'create',
        'status',
        'file',
        'title',
        'run_time',
        'suite_title',
      ])  
    })

    expect(jsonData.tests[0].code).to.be.ok;
    expect(jsonData.tests[0].code).to.include("public function runCestWithTwoFailedTest(")
    expect(jsonData.tests[0].title).to.eql("run cest with two failed test")

    const failedTests = jsonData.tests.filter(t => t.status === 'failed')
    const failedTest = failedTests[0];
    expect(failedTest.stack).to.include('public function')
  })  

  it('should parse JUnit XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/java.xml'))

    expect(jsonData.status).to.eql('failed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed')
    expect(stats.tests_count).to.eql(6)
    expect(jsonData.tests.length).to.eql(stats.tests_count)


    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t).to.contain.keys([
        'stack',
        'create',
        'status',
        'file',
        'title',
        'run_time',
        'suite_title',
      ])
    })

    // expect(jsonData.tests[0].code).to.be.ok;
    // expect(jsonData.tests[0].code).to.include("public function runCestWithTwoFailedTest(")
    // expect(jsonData.tests[0].title).to.eql("Run cest with two failed test")

    const failedTests = jsonData.tests.filter(t => t.status === 'failed')
    const failedTest = failedTests[0];
    expect(failedTest.stack).to.include('(CalculatorTest.java:43')
  })

  describe('#request', () => {

    before(function () {
      this.timeout(5000);
    });

    beforeEach(() => {
      registerHandlers(server, RUN_ID);
    })

    it('should create a new run Id', async () => {
      const reader = new XmlReader({
        url: TESTOMATIO_URL,
        apiKey: TESTOMATIO,
      });
      reader.parse(path.join(__dirname, 'data/junit1.xml'))
      await reader.createRun()
      expect(reader.runId).to.eql(RUN_ID)

      const [req] = server.requests({ method: 'POST', path: '/api/reporter' });
      const expectedResult = { api_key: TESTOMATIO };
      assert.isObject(req.body);
      assert.deepEqual(req.body, expectedResult);
    });

    it('should publish updates', async () => {
      const reader = new XmlReader({
        url: TESTOMATIO_URL,
        apiKey: TESTOMATIO,
        runId: RUN_ID,
      });
      reader.parse(path.join(__dirname, 'data/junit1.xml'))
      expect(reader.runId).to.eql(RUN_ID)

      const resp = await reader.uploadData();
      expect(resp.status).to.eql(200)

      const [req] = server.requests({ method: 'PUT', path: '/api/reporter/' + RUN_ID });
      assert.isObject(req.body);
      expect(req.body).to.include({ status: 'failed' })
    });




    afterEach(() => {
      server.reset();
    });


  })

});
