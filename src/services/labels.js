import createDebugMessages from 'debug';
import { dataStorage } from '../data-storage.js';

const debug = createDebugMessages('@testomatio/reporter:services-labels');
class LabelStorage {
  static #instance;

  /**
   *
   * @returns {LabelStorage}
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new LabelStorage();
    }
    return this.#instance;
  }

  /**
   * Stores labels array and passes it to reporter
   * @param {string[]} labels - array of label strings
   * @param {*} context - full test title
   */
  put(labels, context = null) {
    if (!labels || !Array.isArray(labels)) return;
    dataStorage.putData('labels', labels, context);
  }

  /**
   * Returns labels array for the test
   * @param {*} context testId or test context from test runner
   * @returns {string[]} labels array, e.g. ['smoke', 'severity:high', 'feature:user_account']
   */
  get(context = null) {
    const labelsList = dataStorage.getData('labels', context);
    if (!labelsList || !labelsList?.length) return [];

    const allLabels = [];
    for (const labels of labelsList) {
      if (Array.isArray(labels)) {
        allLabels.push(...labels);
      } else if (typeof labels === 'string') {
        try {
          const parsedLabels = JSON.parse(labels);
          if (Array.isArray(parsedLabels)) {
            allLabels.push(...parsedLabels);
          }
        } catch (e) {
          debug(`Error parsing labels for test ${context}`, labels);
        }
      }
    }

    // Remove duplicates
    return [...new Set(allLabels)];
  }
}

export const labelStorage = LabelStorage.getInstance();