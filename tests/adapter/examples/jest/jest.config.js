export default {
  reporters: ['default', ['<rootDir>/../../../../lib/adapter/jest.js', { apiKey: process.env.TESTOMATIO }]],
  silent: true,
};
