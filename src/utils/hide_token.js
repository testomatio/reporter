/**
 * Hides the Testomat.io API token in any data which is about to be printed or logged.
 * Applied at the logger level, so a raw error object with a request body can't leak the token.
 *
 * @param {string} data
 * @returns {string} The data with every token replaced, empty string if data is not a string.
 */
export function hideTestomatioToken(data) {
  if (typeof data !== 'string') return '';

  return data.replace(/"api_key"\s*:\s*"[^"]+"/g, '"api_key": "<hidden>"').replace(/tstmt_[\w-]+/g, 'tstmt_***');
}
