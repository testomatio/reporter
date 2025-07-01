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
};
