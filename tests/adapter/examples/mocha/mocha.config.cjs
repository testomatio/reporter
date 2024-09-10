module.exports = {
    reporter: './lib/adapter/mocha/mocha.cjs',
    reporterOptions: process.env.TESTOMATIO ? `apiKey=${process.env.TESTOMATIO}` : '',
};
