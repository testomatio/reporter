module.exports = {
  reporter: './lib/adapter/mocha.js',
  reporterOptions: process.env.TESTOMATIO ? `apiKey=${process.env.TESTOMATIO}` : '',
};
