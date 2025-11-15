import createDebugMessages from 'debug';
import { dataStorage } from '../data-storage.js';

const debug = createDebugMessages('@testomatio/reporter:services-links');

class LinkStorage {
  static #instance;

  /**
   *
   * @returns {LinkStorage}
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new LinkStorage();
    }
    return this.#instance;
  }

  /**
   * Stores links array and passes it to reporter
   * @param {object[]} links - array of link objects
   * @param {*} context - full test title
   */
  put(links, context = null) {
    if (!links || !Array.isArray(links)) return;
    dataStorage.putData('links', links, context);
  }

  /**
   * Returns links array for the test
   * @param {*} context testId or test context from test runner
   * @returns {object[]} links array, e.g. [{test: 'TEST-123'}, {jira: 'JIRA-456'}]
   */
  get(context = null) {
    const linksList = dataStorage.getData('links', context);
    if (!linksList || !linksList?.length) return [];

    const allLinks = [];
    for (const links of linksList) {
      if (Array.isArray(links)) {
        allLinks.push(...links);
      } else if (typeof links === 'string') {
        try {
          const parsedLinks = JSON.parse(links);
          if (Array.isArray(parsedLinks)) {
            allLinks.push(...parsedLinks);
          }
        } catch (e) {
          debug(`Error parsing links for test ${context}`, links);
        }
      }
    }

    // Remove duplicates based on JSON string comparison
    const uniqueLinks = [];
    const seen = new Set();
    for (const link of allLinks) {
      const key = JSON.stringify(link);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLinks.push(link);
      }
    }
    return uniqueLinks;
  }
}

export const linkStorage = LinkStorage.getInstance();
