import { log } from './log.js';

/**
 * Set S3 credentials from the provided artifacts object.
 * @param {Object} artifacts - The artifacts object containing S3 credentials.
 */
function setS3Credentials(artifacts) {
  if (!Object.keys(artifacts).length) return;

  log.info( 'S3 credentials obtained from Testomat.io...');

  if (artifacts.ACCESS_KEY_ID) process.env.S3_ACCESS_KEY_ID = artifacts.ACCESS_KEY_ID;
  if (artifacts.SECRET_ACCESS_KEY) process.env.S3_SECRET_ACCESS_KEY = artifacts.SECRET_ACCESS_KEY;
  if (artifacts.REGION) process.env.S3_REGION = artifacts.REGION;
  if (artifacts.BUCKET) process.env.S3_BUCKET = artifacts.BUCKET;
  if (artifacts.SESSION_TOKEN) process.env.S3_SESSION_TOKEN = artifacts.SESSION_TOKEN;
  if (artifacts.presign) process.env.TESTOMATIO_PRIVATE_ARTIFACTS = '1';
  if (artifacts.stack_artifacts) process.env.TESTOMATIO_STACK_ARTIFACTS = '1';
  // endpoint is not received from the server; and shuld be empty if IAM used (credentails obtained from the testomat)
  process.env.S3_ENDPOINT = artifacts.ENDPOINT || '';
}

/**
 * Generates mode request parameters based on the input params.
 * @param {{type: string, id?: string, apiKey: string}} params - The input parameters for the request.
 * @returns {Object|null} - An object containing the generated request parameters, or null if the type is invalid.
 */
function generateFilterRequestParams(params) {
  // Defensive check: ensure params is an object
  if (!params || typeof params !== 'object') {
    log.error( `Invalid parameters provided. Expected an object, got: ${typeof params}`);
    return;
  }

  const { type, id, apiKey } = params;

  if (!type) {
    return;
  }

  if (!id) {
    log.error( `Please make sure your settings "${type.toUpperCase()}"= "${id}" is correct!`);
    return;
  }

  return {
    params: {
      type,
      id: encodeURIComponent(id),
      api_key: apiKey,
    },
    responseType: 'json',
  };
}

/**
 * Parse filter parameters from a string in the format "type=id".
 * @param {string} opts - The input string containing the filter parameters.
 * @returns {Object} An object containing the parsed filter parameters.
 *                   The object has properties "type" and "id".
 */
function parseFilterParams(opts) {
  const [type, ...idParts] = opts.split('=');
  const id = idParts.join('=');
  
  const validType = updateFilterType(type);

  if (!validType) return undefined;

  return {
    type: validType,
    id,
  };
}

/**
 * Update and validate the filter type.
 * @param {string} type - The original filter type.
 * @returns {string|undefined} The updated and validated filter type.
 *                            Returns undefined if the type is not valid.
 */
function updateFilterType(type) {
  if (!type || typeof type !== 'string') return;

  let typeLowerCase = type.toLowerCase();

  const filterTypes = ['tag-name', 'plan', 'label', 'jira-ticket'];

  if (typeLowerCase === 'plan-id') {
    typeLowerCase = 'plan';
  }

  const filterApi = [
    'tag',
    'plan',
    'label',
    'jira',
    // "ims-issue", //TODO: WIP
  ];

  if (!filterTypes.includes(typeLowerCase)) {
    log.error( `❗ Invalid filter: "${type}" start settings! Available option list: ${filterTypes}`);
    return;
  }

  const index = filterTypes.indexOf(typeLowerCase);

  return index !== -1 ? filterApi[index] : undefined;
}

/**
 * Return an emoji based on the provided status.
 * @param {string} status - The status value ('passed', 'failed', or 'skipped').
 * @returns {string} - An emoji corresponding to the provided status.
 */
function statusEmoji(status) {
  if (status === 'passed') return '🟢';
  if (status === 'failed') return '🔴';
  if (status === 'skipped') return '🟡';
  return '';
}

/**
 * Generate a full name string based on the provided test object.
 * @param {object} t - The test object.
 * @returns {string} - A formatted full name string for the test object.
 */
function fullName(t) {
  let line = '';
  if (t.suite_title) line = `${t.suite_title}: `;
  line += `**${t.title}**`;
  if (t.example) line += ` \`[${Object.values(t.example)}]\``;
  return line;
}

/**
 * Parses a comma-separated list of key-value pairs into an options object.
 *
 * The input string should be formatted as `"key1=value1,key2=value2,..."`.
 * Whitespace around keys and values is trimmed. If the input is empty or undefined,
 * an empty object is returned.
 *
 * @param {string} [optionsStr] - A comma-separated string of key=value pairs.
 * @returns {Object} An object mapping option keys to their string values.
 *
 * @example
 * parsePipeOptions('foo=bar,baz=qux');
 * => Returns: { foo: 'bar', baz: 'qux' }
 */
function parsePipeOptions(optionsStr) {
  const options = {};
  if (!optionsStr) return options;

  const pairs = optionsStr.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      options[key.trim()] = value.trim();
    }
  }
  return options;
}

/**
 * Calculate the approximate size of data in bytes (JSON stringified, UTF-8 encoded length).
 * @param {Object} data - Data to measure
 * @returns {number} Size in bytes
 */
function getObjectSize(data) {
  const body = JSON.stringify(data);
  return new TextEncoder().encode(body).length;
}

/**
 * Split a tests array into chunks bounded by serialized size.
 * Used by the XML and Allure readers so both upload tests with identical batching:
 * each chunk becomes a single batch request (manual batch mode), which keeps requests
 * under the size limit and guarantees every test is sent exactly once.
 *
 * @param {Array} tests - Array of tests to split
 * @param {number} [maxSizeBytes=1048576] - Maximum serialized size per chunk (default 1MB)
 * @returns {Array<Array>} Array of test chunks
 */
function splitTestsIntoChunks(tests, maxSizeBytes = 1 * 1024 * 1024) {
  const chunks = [];
  let currentChunk = [];
  let currentChunkSize = 0;

  for (const test of tests) {
    const testSize = getObjectSize(test);

    const wouldExceedSize = currentChunkSize + testSize > maxSizeBytes;

    if (wouldExceedSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkSize = 0;
    }

    currentChunk.push(test);
    currentChunkSize += testSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Format a list of test IDs for `--filter-list` machine-readable output.
 * Used when the CLI `--format` option is passed,
 * e.g. `--filter-list "coverage:file=..." --format grep`.
 *
 * @param {string[]} ids
 * @param {'grep'|'json'|'newline'|'ids'} format
 * @returns {string} Empty string if no ids; otherwise the formatted output.
 */
function formatFilterListIds(ids, format) {
  if (!ids || ids.length === 0) return '';
  switch (format) {
    case 'grep': return `(${ids.join('|')})`;
    case 'json': return JSON.stringify(ids);
    case 'newline': return ids.join('\n');
    case 'ids':
    default: return ids.join(',');
  }
}

export {
  updateFilterType,
  parseFilterParams,
  generateFilterRequestParams,
  setS3Credentials,
  statusEmoji,
  fullName,
  parsePipeOptions,
  formatFilterListIds,
  getObjectSize,
  splitTestsIntoChunks,
};
