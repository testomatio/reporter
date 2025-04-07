import pc from 'picocolors';
import { APP_PREFIX } from '../constants.js';

export function checkForEnvPassedAsArguments() {
  const testomatioArgs = process.argv.filter(arg => arg.startsWith('TESTOMATIO'));
  if (testomatioArgs.length === 0) return;

  console.log(pc.yellow(`${APP_PREFIX} Found TESTOMATIO env passed as CLI arguments: ${testomatioArgs.join(', ')}`));
  console.log(pc.yellow(`${APP_PREFIX} These variables can't be processed and will be ignored`));
  console.log(pc.yellow(`${APP_PREFIX} Please use the following format instead:`));
  console.log(pc.yellow(`${APP_PREFIX} ${testomatioArgs.join(' ')} ${process.argv[1].split('/').pop()}`));
  console.log();
}
