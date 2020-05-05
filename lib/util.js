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

const ansiRegExp = () => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|');

  return new RegExp(pattern, 'g');
};

module.exports = {
  parseTest,
  ansiRegExp,
};
