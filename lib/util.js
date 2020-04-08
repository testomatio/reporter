/**
 * @param {String} testTitle - Test title
 *
 * @returns {String} testId
 */
const parseTest = testTitle => {
  const captures = testTitle.match(/@T([\w\d]+)/);
  if (captures) {
    console.log(captures[1]);
    return captures[1];
  }

  return null;
};


module.exports = {
  parseTest,
};
