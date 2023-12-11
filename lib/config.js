// This file is used to read environment variables from .env file and process.env

// ! uncommenting next line leads ro reading vars from .env file
// require('dotenv').config();
const debug = require('debug')('@testomatio/reporter:config');

/* for possibility to use multiple env files (reading different paths)
const dotenv = require('dotenv');
const envFileVars = dotenv.config({ path: '.env' }).parsed; */

const TESTOMATIO = process.env.TESTOMATIO || process.env.TESTOMATIO_API_KEY || process.env.TESTOMATIO_TOKEN || '';
if (TESTOMATIO === 'undefined') console.error('TESTOMATIO is "undefined". Something went wrong. Contact dev team.');
process.env.TESTOMATIO = TESTOMATIO;

// select only TESTOMATIO related variables (only to print them in debug)
const testomatioEnvVars =
  Object.keys(process.env)
    .filter(key => key.startsWith('TESTOMATIO') || key.startsWith('S3_'))
    .reduce((obj, key) => {
      obj[key] = process.env[key];
      return obj;
    }, {}) || {};
debug('TESTOMATIO variables:', testomatioEnvVars);

// includes variables from .env file and process.env
const config = process.env;

module.exports = config;
module.exports.TESTOMATIO = TESTOMATIO;
