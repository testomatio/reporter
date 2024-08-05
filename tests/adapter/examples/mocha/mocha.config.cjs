
module.exports = {
    reporter: './lib-cjs/lib/adapter/mocha.js',
    reporterOptions: process.env.TESTOMATIO ? `apiKey=${process.env.TESTOMATIO}` : '',
};
