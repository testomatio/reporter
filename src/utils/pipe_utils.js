import { APP_PREFIX } from '../constants.js';

/**
 * Set S3 credentials from the provided artifacts object.
 * @param {Object} artifacts - The artifacts object containing S3 credentials.
 */
function setS3Credentials(artifacts) {
  if (!Object.keys(artifacts).length) return;

  console.log(APP_PREFIX, 'S3 credentials obtained from Testomat.io...');

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
    console.error(APP_PREFIX, `Invalid parameters provided. Expected an object, got: ${typeof params}`);
    return;
  }

  const { type, id, apiKey } = params;

  if (!type) {
    return;
  }

  if (!id) {
    console.error(APP_PREFIX, `Please make sure your settings "${type.toUpperCase()}"= "${id}" is correct!`);
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
 * Parse multiple filter parameters from a string in format "type1=id1,type2=id2".
 * @param {string} opts - The input string containing filter parameters.
 * @returns {Array<{type: string, id: string}>} Array of parsed filter objects.
 */
function parseFilterParams(opts) {
  if (!opts || typeof opts !== 'string') return [];

  const filters = [];
  const pairs = opts.split(',');

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed || !trimmed.includes('=')) continue;

    const [type, ...idParts] = trimmed.split('=');
    const id = idParts.join('=');

    if (type && id) {
      filters.push({ type: type.toLowerCase(), id });
    }
  }

  return filters;
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

export {
  parseFilterParams,
  generateFilterRequestParams,
  setS3Credentials,
  statusEmoji,
  fullName,
  parsePipeOptions
};
