// const { TESTOMATIO } = require('../../config');

exports.config = {
  tests: './*_test.js',
  output: './output',
  helpers: {
    // Remove Puppeteer helper to avoid browser dependency
    FileSystem: {},
  },
  include: {
    I: './steps_file.js',
  },
  bootstrap: null,
  mocha: {},
  name: 'codecept',
  plugins: {
    pauseOnFail: {},
    retryFailedStep: {
      enabled: true,
    },
    tryTo: {
      enabled: true,
    },
    screenshotOnFail: {
      enabled: true,
    },
    testomat: {
      enabled: true,
      require: '../../../../lib/adapter/codecept',
      // apiKey: TESTOMATIO,
    },
  },
};
