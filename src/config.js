// This file is used to read environment variables from .env file
import createDebugMessages from 'debug';

const debug = createDebugMessages('@testomatio/reporter:config');

/* for possibility to use multiple env files (reading different paths)
const envFileVars = dotenv.config({ path: '.env' }).parsed; */

if (process.env.TESTOMATIO_API_KEY && !process.env.TESTOMATIO) {
  process.env.TESTOMATIO = process.env.TESTOMATIO_API_KEY;
}
if (process.env.TESTOMATIO_TOKEN && !process.env.TESTOMATIO) {
  process.env.TESTOMATIO = process.env.TESTOMATIO_TOKEN;
}

if (process.env.TESTOMATIO === 'undefined')
  console.error('TESTOMATIO is "undefined". Something went wrong. Contact dev team.');

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
export const config = process.env;
