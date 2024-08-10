module.exports = {
    // reporter: './lib-cjs/lib/adapter/mocha.js',
    reporter: './lib/adapter/mocha/mocha.cjs',
    reporterOptions: process.env.TESTOMATIO ? `apiKey=${process.env.TESTOMATIO}` : '',
};
