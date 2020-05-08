const { Formatter } = require('cucumber');
const { TestomatClient, TRConstants } = require('../reporter');
const { parseTest } = require('../util');

const createTestomatFormatter = apiKey => {
  if (!apiKey || apiKey === '') {
    throw new Error('Api key cannot be empty');
  }

  const documents = {};

  const addDocument = gherkinDocument => {
    documents[gherkinDocument.uri] = gherkinDocument.document;
  };

  const getTitle = scenario => {
    let { name } = scenario;
    if (scenario.tags.length) {
      let tags = '';
      for (const tag of scenario.tags) {
        tags = `${tags} ${tag.name}`;
      }
      name = `${name}${tags}`;
    }
    return name;
  };

  const getFeature = uri => documents[uri].feature;

  const getScenario = location => {
    const { children } = getFeature(location.uri);
    for (const scenario of children) {
      if (scenario.type === 'Scenario' && scenario.location.line === location.line) {
        return scenario;
      }
      if (scenario.type === 'ScenarioOutline') {
        for (const example of scenario.examples) {
          for (const tableBody of example.tableBody) {
            if (tableBody.location.line === location.line) {
              return scenario;
            }
          }
        }
      }
    }

    return null;
  };

  const getTestId = scenario => {
    if (scenario) {
      for (const tag of scenario.tags) {
        const testId = parseTest(tag.name);
        if (testId) return testId;
      }
    }

    return null;
  };

  return class TestomatFormatter extends Formatter {
    constructor(options) {
      super(options);
      this.client = new TestomatClient({ apiKey });
      this.status = TRConstants.PASSED;

      options.eventBroadcaster.on('gherkin-document', addDocument);
      options.eventBroadcaster.on('test-run-started', () => this.client.createRun());
      options.eventBroadcaster.on('test-case-finished', this.onTestCaseFinished.bind(this));
      options.eventBroadcaster.on('test-run-finished', () => this.client.updateRunStatus(this.status));
    }

    onTestCaseFinished(event) {
      const scenario = getScenario(event.sourceLocation);
      const testId = getTestId(scenario);
      const status = event.result.status === 'undefined' ? TRConstants.SKIPPED : event.result.status;
      let error = '';
      if (event.result.exception) {
        error = event.result.exception.message;
      }
      console.log(scenario.name, ' : ', status);
      if (status !== TRConstants.PASSED && status !== TRConstants.SKIPPED) {
        this.status = TRConstants.FAILED;
      }
      this.client.addTestRun(testId, status, error, getTitle(scenario));
    }
  };
};

module.exports = createTestomatFormatter(process.env.TESTOMATIO);
