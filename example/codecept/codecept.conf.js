exports.config = {
  tests: './*_test.js',
  output: './output',
  helpers: {
    Puppeteer: {
      url: 'http://localhost',
      show: true,
    },
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
      apiKey: 'lz8ea4948ud5',
    },
  },
};
