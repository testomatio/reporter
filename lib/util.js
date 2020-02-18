/**
 * @param {String} testTitle - Test title
 *
 * @returns {String} testId
 */
const parseTest = testTitle => {
  if (!testTitle.includes('@T')) return null;
  const testArray = testTitle.split(' ');
  for (const test of testArray) {
    if (test.startsWith('@T')) {
      return test.substring(2, test.length);
    }
  }

  return null;
};


module.exports = {
  parseTest,
};
