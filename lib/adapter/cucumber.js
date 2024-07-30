import { CucumberReporter } from './cucumber/current.js';
import { CucumberLegacyReporter } from './cucumber/legacy.js';

let exportedModule = {};

try {
  // @ts-ignore
  await import('@cucumber/cucumber');
  exportedModule = CucumberReporter;
} catch (_e) {
  try {
    // @ts-ignore
    await import('cucumber');
    exportedModule = CucumberLegacyReporter;
  } catch (_err) {
    console.error('Cucumber packages: "@cucumber/cucumber" or "cucumber" were not detected. Report won\'t be sent');
    exportedModule = {};
  }
}

export default exportedModule;
