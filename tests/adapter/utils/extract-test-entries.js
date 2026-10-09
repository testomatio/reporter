/**
 * Tests are emitted into the debug file either as individual `addTest` entries or
 * bundled into a single `addTestsBatch` entry, depending on batch mode. Both are
 * valid; normalize them into the `{ testId }` shape the adapter assertions expect.
 * @param {Array<Object>} debugData - parsed debug-file log entries
 * @returns {Array<{ testId: Object }>}
 */
export function extractTestEntries(debugData) {
  return debugData.flatMap(entry => {
    if (entry.action === 'addTest' && entry.testId) return [{ testId: entry.testId }];
    if (entry.action === 'addTestsBatch' && Array.isArray(entry.tests)) {
      return entry.tests.map(testId => ({ testId }));
    }
    return [];
  });
}
