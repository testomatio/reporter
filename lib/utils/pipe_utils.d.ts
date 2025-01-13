/**
 * Update and validate the filter type.
 * @param {string} type - The original filter type.
 * @returns {string|undefined} The updated and validated filter type.
 *                            Returns undefined if the type is not valid.
 */
export function updateFilterType(type: string): string | undefined;
/**
 * Parse filter parameters from a string in the format "type=id".
 * @param {string} opts - The input string containing the filter parameters.
 * @returns {Object} An object containing the parsed filter parameters.
 *                   The object has properties "type" and "id".
 */
export function parseFilterParams(opts: string): any;
/**
 * Generates mode request parameters based on the input params.
 * @param {{type: string, id?: string, apiKey: string}} params - The input parameters for the request.
 * @returns {Object|null} - An object containing the generated request parameters, or null if the type is invalid.
 */
export function generateFilterRequestParams(params: {
    type: string;
    id?: string;
    apiKey: string;
}): any | null;
/**
 * Set S3 credentials from the provided artifacts object.
 * @param {Object} artifacts - The artifacts object containing S3 credentials.
 */
export function setS3Credentials(artifacts: any): void;
/**
 * Return an emoji based on the provided status.
 * @param {string} status - The status value ('passed', 'failed', or 'skipped').
 * @returns {string} - An emoji corresponding to the provided status.
 */
export function statusEmoji(status: string): string;
/**
 * Generate a full name string based on the provided test object.
 * @param {object} t - The test object.
 * @returns {string} - A formatted full name string for the test object.
 */
export function fullName(t: object): string;
