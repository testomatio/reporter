import chalk from 'chalk';

let chalkUsed;

if (typeof require !== 'undefined' && typeof module !== 'undefined') {
  chalkUsed = require('chalk4');
} else {
  chalkUsed = chalk;
}

export default chalkUsed;
