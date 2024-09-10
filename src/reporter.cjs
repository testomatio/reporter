const _reporter = require('../lib/reporter.js');

/**
 * @typedef {import('../lib/client.js').default} TestomatClient
 * @typedef {import('../lib/constants.js')} TRConstants
 * @typedef {import('../lib/reporter-functions.js')} artifact
 * @typedef {import('../lib/reporter-functions.js')} log
 * @typedef {import('../lib/reporter-functions.js')} logger
 * @typedef {import('../lib/reporter-functions.js')} meta
 * @typedef {import('../lib/reporter-functions.js')} step
 * 
 * "Reporter" type which is object containing all types from the above
 * @typedef {{artifact: artifact, log: log, logger: logger, meta: meta, step: step, TestomatClient: TestomatClient, TRConstants: TRConstants}} Reporter
 */

// const reporter = _reporter;

/**
 * @type {Reporter}
 */
const reporter = _reporter;
module.exports = reporter;
