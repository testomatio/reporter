const { resetConfig } = require('../fileUploader');
const { APP_PREFIX } = require('../constants');

/**
 * Set S3 credentials from the provided artifacts object.
 * @param {Object} artifacts - The artifacts object containing S3 credentials.
 */
function setS3Credentials(artifacts) {
  if (!Object.keys(artifacts).length) return;

  console.log(APP_PREFIX, 'S3 were credentials obtained from Testomat.io...');

  if (artifacts.ACCESS_KEY_ID) process.env.S3_ACCESS_KEY_ID = artifacts.ACCESS_KEY_ID;
  if (artifacts.SECRET_ACCESS_KEY) process.env.S3_SECRET_ACCESS_KEY = artifacts.SECRET_ACCESS_KEY;
  if (artifacts.REGION) process.env.S3_REGION = artifacts.REGION;
  if (artifacts.BUCKET) process.env.S3_BUCKET = artifacts.BUCKET;
  if (artifacts.ENDPOINT) process.env.S3_ENDPOINT = artifacts.ENDPOINT;
  if (artifacts.SESSION_TOKEN) process.env.S3_SESSION_TOKEN = artifacts.SESSION_TOKEN;
  if (artifacts.presign) process.env.TESTOMATIO_PRIVATE_ARTIFACTS = '1';
  resetConfig();
}
/**
 * Generates mode request parameters based on the input params.
 * @param {Object} params - The input parameters for the request.
 * @param {string} params.type - The type of the request (e.g., "tag").
 * @param {string} params.id - The ID associated with the request.
 * @param {string} params.apiKey - The API key for authentication.
 * @returns {Object|null} - An object containing the generated request parameters, or null if the type is invalid.
 */
function generateFilterRequestParams(params) {
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
 * Parse filter parameters from a string in the format "type=id".
 * @param {string} opts - The input string containing the filter parameters.
 * @returns {Object} An object containing the parsed filter parameters.
 *                   The object has properties "type" and "id".
 */
function parseFilterParams(opts) {
  const [type, id] = opts.split('=');
  const validType = updateFilterType(type);

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
  const typeLowerCase = type.toLowerCase();

  const filterTypes = ['tag-name', 'plan-id', 'label', 'jira-ticket'];

  const filterApi = [
    'tag',
    'plan',
    'label',
    'jira',
    // "ims-issue", //TODO: WIP
  ];

  if (!filterTypes.includes(typeLowerCase)) {
    console.log(APP_PREFIX, `❗❗❗ Invalid "filter=${type}" start settings! Available option list: ${filterTypes}`);
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

module.exports = {
  updateFilterType,
  parseFilterParams,
  generateFilterRequestParams,
  setS3Credentials,
  statusEmoji,
  fullName,
};
