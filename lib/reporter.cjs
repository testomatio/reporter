const _reporter = require('../cjs/lib/reporter.js');

/**
 * @typedef {import('../cjs/lib/client.js').default} TestomatClient
 * @typedef {import('../cjs/lib/constants.js')} TRConstants
 * @typedef {import('../cjs/lib/reporter-functions.js')} artifact
 * @typedef {import('../cjs/lib/reporter-functions.js')} log
 * @typedef {import('../cjs/lib/reporter-functions.js')} logger
 * @typedef {import('../cjs/lib/reporter-functions.js')} meta
 * @typedef {import('../cjs/lib/reporter-functions.js')} step
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
