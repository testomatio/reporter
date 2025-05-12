import { execSync } from 'child_process';
import { chmod } from 'fs/promises';
import { join } from 'path';

// Run edit-js-files.js
import './edit-js-files.js';

// Run edit-package-json.js
import './edit-package-json.js';

// Make copy-tesmplate.sh executable and run it
const templateScript = join(process.cwd(), 'build', 'scripts', 'copy-tesmplate.sh');
await chmod(templateScript, '755');
execSync(templateScript, { stdio: 'inherit' }); 