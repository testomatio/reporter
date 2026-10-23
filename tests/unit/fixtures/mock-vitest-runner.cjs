let currentTest = null;

module.exports = {
  getCurrentTest: () => currentTest,
  __setCurrentTest: test => {
    currentTest = test;
  },
};
