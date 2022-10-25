// eslint-disable-next-line import/no-unresolved
const { Formatter } = require('cucumber');
const chalk = require('chalk');
const { TestomatClient, TRConstants } = require('../../reporter');
const { parseTest } = require('../../util');

const createTestomatFormatter = apiKey => {
  if (!apiKey || apiKey === '') {
    console.log(chalk.red('TESTOMATIO key is empty, ignoring reports'));
  }

  const documents = {};
  const dataTableMap = {};

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

  const loadDataTable = (scenario, uri) => {
    if (scenario.type === 'ScenarioOutline') {
      for (const example of scenario.examples) {
        for (const tableBody of example.tableBody) {
          const dataMap = example.tableHeader.cells.reduce((acc, cell, index) => {
            acc[cell.value] = tableBody.cells[index].value;
            return acc;
          }, {});

          dataTableMap[`${uri}:${tableBody.location.line}`] = JSON.stringify(dataMap);
        }
      }
    }
  };

  const getDataTableMap = (scenario, sourceLocation) => {
    const key = `${sourceLocation.uri}:${sourceLocation.line}`;
    if (!dataTableMap[key]) {
      loadDataTable(scenario, sourceLocation.uri);
    }

    return dataTableMap[key] || '';
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

      if (!apiKey) return;

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

      let example = getDataTableMap(scenario, event.sourceLocation);
      if (example) example = JSON.parse(example);

      if (!scenario.name) return;

      let message = '';
      let cliMessage = `- ${scenario.name}: ${chalk.bold(status.toUpperCase())}`;

      if (event.result.status === 'undefined') {
        cliMessage += chalk.yellow(
          ' (undefined steps. Run Cucumber without this formatter and implement missing steps)',
        );
        message = 'Undefined steps. Implement missing steps and rerun this scenario';
      }
      console.log(cliMessage);
      if (status !== TRConstants.PASSED && status !== TRConstants.SKIPPED) {
        this.status = TRConstants.FAILED;
      }
      this.client.addTestRun(testId, status, {
        error: event.result.exception,
        message,
        example,
        title: getTitle(scenario),
      });
    }
  };
};

module.exports = createTestomatFormatter(process.env.TESTOMATIO);
