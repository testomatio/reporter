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
      require: './test',
      apiKey: 'l5x5d5cd6pc3',
    },
  },
};
