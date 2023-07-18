const path = require('path');
const fs = require('fs');
const { TESTOMAT_TMP_STORAGE } = require('./constants');

// NEXT HELPERS ARE CREATED FOR PLAYWRIGHT. IGNORE FOR NOW. PROBABLY WILL BE REMOVED SHORTLY

// TEST_WORKER_INDEX is not available inside the test listener :/
/**
 * Sets id of currently running test to storage (global variable or file)
 * Used for Playwright
 * @param {*} testId
 */
function setCurrentlyRunningTestIdForPlaywright(testId) {
  const workerId = +process.env.TEST_WORKER_INDEX || 0;
  const filePath = path.join(TESTOMAT_TMP_STORAGE.mainDir,  'current_test_id_' + workerId);
  fs.writeFileSync(filePath, testId);
}

/**
 * Gets id of currently running test from storage (global variable or file)
 * Used for Playwright
 * @returns string test id of currently running test
 */
function getCurrentlyRunningTestIdForPlaywright() {
  const workerId = +process.env.TEST_WORKER_INDEX || 0;
  const filePath = path.join(TESTOMAT_TMP_STORAGE.mainDir, 'current_test_id_' + workerId);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8') || null;
  }
  return null;
};

module.exports.setCurrentlyRunningTestId = setCurrentlyRunningTestIdForPlaywright;
module.exports.getCurrentlyRunningTestId = getCurrentlyRunningTestIdForPlaywright;
