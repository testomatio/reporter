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

    expect(jsonData.tests[0].title).to.eql("Login With Valid Credentials")

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
    expect(jsonData.tests[0].title).to.eql("Run Cest With Two Failed Test")

    const failedTests = jsonData.tests.filter(t => t.status === 'failed')
    const failedTest = failedTests[0];
    expect(failedTest.stack).to.include('public function')
  })

  it('should parse simple JUnit XML', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(__dirname, 'data/junit_simple.xml'))

    expect(jsonData.status).to.eql('failed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed')
    expect(stats.tests_count).to.eql(1)


    reader.formatErrors();
    reader.formatTests();

    const test = jsonData.tests[0];
    expect(test.file).to.eql('tests/LoginTest.java');
    expect(test.title).to.eql('Login');
    expect(test.test_id).to.eql('8acca9eb');
  })

  it('should parse JUnit XML', () => {
    const reader = new XmlReader({ lang: 'java' });
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
    console.log(failedTest.stack)
    expect(failedTest.stack).to.include('(CalculatorTest.java:43')
  })

  it('should parse Selenide JUnit XML', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(__dirname, 'data/selenide.xml'))

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

    const failedTests = jsonData.tests.filter(t => t.status === 'failed')
    const failedTest = failedTests[0];
    console.log(failedTest.stack)
    expect(failedTest.stack).to.include('SUITE-BEFORE')
    expect(failedTest.stack).to.include('SUITE ERR')
  })  

  it('should parse JUnit XML and skipped tests', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/junit_skipped.xml'))

    expect(jsonData.status).to.eql('failed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed')
    expect(stats.tests_count).to.eql(2)

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

    const skippedTests = jsonData.tests.filter(t => t.status === 'skipped')
    expect(skippedTests.length).to.eql(1)
    const skippedTest = skippedTests[0];
    expect(skippedTest.title).to.eql('Check Dashboard')
  })

  it('should parse JUnit params', () => {
    const reader = new XmlReader({ lang: 'java' });
    const jsonData = reader.parse(path.join(__dirname, 'data/junit2.xml'))

    expect(jsonData.status).to.eql('passed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('passed')
    expect(stats.tests_count).to.eql(4)

    reader.connectAdapter();
    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

    jsonData.tests.forEach(t => {
      expect(t.title).to.eql('Can Create API Key ${param}')
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

    expect(jsonData.tests[0].example.param).to.eql('Master');
  })    


  it('should parse JUnit C#', () => {
    const reader = new XmlReader({ lang: 'c#' });
    reader.connectAdapter();
    const jsonData = reader.parse(path.join(__dirname, 'data/csharp.xml'))

    expect(jsonData.status).to.eql('failed')
    const stats = reader.calculateStats();
    expect(stats.status).to.eql('failed')
    expect(stats.tests_count).to.eql(3)
    expect(jsonData.tests.length).to.eql(stats.tests_count)


    reader.fetchSourceCode();
    reader.formatErrors();
    reader.formatTests();

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
    
    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Create a Web Lead');
    expect(tests[0].suite_title).to.include('User');
  })

  it('should parse NUnit TRX XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/nunit.xml'))

    expect(jsonData.status).to.eql('passed')
    expect(jsonData.tests_count).to.eql(2)
    expect(jsonData.tests.length).to.eql(2)

    reader.formatTests();

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
    
    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Create User Login');
    expect(tests[0].suite_title).to.include('User');
  })

  it('should parse NUnit3 XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/nunit3.xml'))

    expect(jsonData.status).to.eql('failed')
    expect(jsonData.tests_count).to.eql(3)
    expect(jsonData.tests.length).to.eql(3)

    reader.formatTests();

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
    
    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Update User');
    expect(tests[0].suite_title).to.include('User');
  })  

  it('should parse XUnit XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/xunit.xml'))

    expect(jsonData.status).to.eql('failed')
    expect(jsonData.tests_count).to.eql(6)
    expect(jsonData.tests.length).to.eql(6)

    reader.formatTests();

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
    
    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Method1');
    expect(tests[0].suite_title).to.include('TestClass1');
    expect(tests[0].file).to.eql('Sample/Tests');
    expect(tests[0].status).to.eql('passed');
  })

  it('should parse XUnit2 client XML', () => {
    const reader = new XmlReader();
    const jsonData = reader.parse(path.join(__dirname, 'data/xunit2.xml'))

    expect(jsonData.status).to.eql('passed')
    expect(jsonData.tests_count).to.eql(1)
    expect(jsonData.tests.length).to.eql(1)

    reader.formatTests();

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
    
    const tests = jsonData.tests;
    expect(tests[0].title).to.include('Test');
    expect(tests[0].suite_title).to.include('Class1');
    expect(tests[0].file).to.eql('ConsoleApp2');
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
        testomatioUrl: TESTOMATIO_URL,
        apiKey: TESTOMATIO,
      });
      reader.parse(path.join(__dirname, 'data/junit1.xml'))
      await reader.createRun()
      
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
      reader.parse(path.join(__dirname, 'data/junit1.xml'))

      await reader.createRun()
      const [req] = server.requests({ method: 'PUT', path: '/api/reporter/' + RUN_ID });
      assert.isObject(req.body);
    });

    afterEach(() => {
      server.reset();
    });


  })

});
