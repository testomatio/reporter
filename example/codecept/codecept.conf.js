exports.config = {
  tests: './*_test.js',
  output: './output',
  // Enable BDD (Gherkin) features
  gherkin: {
    features: './features/*.feature',
    steps: './step_definitions/*.js'
  },
  helpers: {
    // Use Expect helper for assertions without browser dependencies
    Expect: {
       require: '@codeceptjs/expect-helper'
    },
  },
  include: {
    I: './steps_file.js',
  },
  bootstrap: null,
  mocha: {},
  name: 'codecept-test-project',
  plugins: {
    retryFailedStep: {
      enabled: false,
    },
    screenshotOnFail: {
      enabled: false,
    },
    testomat: {
      enabled: true,
      require: '../../lib/adapter/codecept',
    },
  },
  // Multiple test execution configurations
  multiple: {
    basic: {
      grep: '@comprehensive',
      browsers: ['chrome']
    },
    hooks: {
      grep: '@hooks',
      browsers: ['chrome']
    },
    failing: {
      grep: '@failing-hooks',
      browsers: ['chrome']
    },
    edge: {
      grep: '@edge-cases',
      browsers: ['chrome']
    },
    hierarchy: {
      grep: '@parent|@child|@grandchild',
      browsers: ['chrome']
    },
    bdd: {
      grep: '@bdd-feature',
      browsers: ['chrome']
    }
  }
};
