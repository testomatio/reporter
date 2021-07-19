const chalk = require("chalk");

const APP_PREFIX = chalk.gray("[TESTOMATIO]");

module.exports = Object.freeze({
  PASSED: "passed",
  FAILED: "failed",
  SKIPPED: "skipped",
  APP_PREFIX,
});
