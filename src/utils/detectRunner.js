import fs from 'fs';
import path from 'path';
import pc from 'picocolors';

const LAUNCHER_PREFIXES = ['npx', 'npm', 'yarn', 'pnpm', 'bun', 'node', 'bunx'];

const PLACEHOLDER_PHRASE_RE = /^<?-*(?:run|your|test)\s+(?:[\w-]+\s+)?(?:tests?|command|runner)>?$/i;

const RUNNERS = [
  {
    name: 'Playwright',
    configs: ['playwright.config.js', 'playwright.config.ts', 'playwright.config.mjs', 'playwright.config.cjs'],
    dependencies: ['@playwright/test'],
    command: 'npx playwright test',
  },
  {
    name: 'CodeceptJS',
    configs: ['codecept.conf.js', 'codecept.conf.ts'],
    dependencies: ['codeceptjs'],
    command: 'npx codeceptjs run',
  },
  {
    name: 'WebdriverIO',
    configs: ['wdio.conf.js', 'wdio.conf.ts'],
    dependencies: ['@wdio/cli'],
    dependencyPrefix: '@wdio/',
    command: 'npx wdio run ./wdio.conf.js',
  },
  {
    name: 'Cypress',
    configs: ['cypress.config.js', 'cypress.config.ts'],
    dependencies: ['cypress'],
    command: 'npx cypress run',
  },
  {
    name: 'Jest',
    configs: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'],
    dependencies: ['jest'],
    command: 'npx jest',
  },
  {
    name: 'Vitest',
    configs: ['vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs'],
    dependencies: ['vitest'],
    command: 'npx vitest run',
  },
  {
    name: 'Mocha',
    configs: ['.mocharc.js', '.mocharc.cjs', '.mocharc.json', '.mocharc.yml', '.mocharc.yaml'],
    dependencies: ['mocha'],
    command: 'npx mocha',
  },
  {
    name: 'Cucumber',
    configs: ['cucumber.js', 'cucumber.cjs'],
    dependencies: ['@cucumber/cucumber'],
    command: 'npx cucumber-js',
  },
];

/**
 * @param {string} command
 * @returns {boolean}
 */
function isPlaceholderCommand(command) {
  const cmd = (command || '').trim();
  if (!cmd) return false;

  if (cmd.includes('<') || cmd.includes('>')) return true;

  const firstToken = cmd.split(/\s+/)[0].toLowerCase();
  if (LAUNCHER_PREFIXES.includes(firstToken)) return false;

  return PLACEHOLDER_PHRASE_RE.test(cmd);
}

/**
 * @param {string} cwd
 * @returns {Record<string, string>}
 */
function readPackageDependencies(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {
    return {};
  }
}

/**
 * @param {string} [cwd]
 * @returns {{ name: string, command: string } | null}
 */
function detectRunner(cwd = process.cwd()) {
  const dependencies = readPackageDependencies(cwd);

  for (const runner of RUNNERS) {
    const config = runner.configs.find(file => fs.existsSync(path.join(cwd, file)));

    const hasDependency = runner.dependencies?.some(dep => dependencies[dep])
      || (runner.dependencyPrefix && Object.keys(dependencies).some(dep => dep.startsWith(runner.dependencyPrefix)));

    if (!config && !hasDependency) continue;

    let command = runner.command;
    if (runner.name === 'WebdriverIO') {
      command = `npx wdio run ./${config || 'wdio.conf.js'}`;
    }

    return { name: runner.name, command };
  }

  return null;
}

/**
 * @param {string} [cwd]
 * @returns {string}
 */
function runnerHint(cwd = process.cwd()) {
  const runner = detectRunner(cwd);
  if (runner) {
    return `💡 Looks like this project uses ${runner.name}. Try: ${pc.green(runner.command)}`;
  }
  return `💡 Replace the placeholder with your test runner command, e.g. ${pc.green('npx playwright test')}`;
}

/**
 * @param {string} command
 * @returns {string[]}
 */
function buildFilterWarning(command) {
  return [
    '⚠️  The runner exited with a non-zero code while a Testomat.io filter was applied.',
    'Your command was modified to run only tests matching Testomat IDs:',
    `  ${pc.bold(command)}`,
    'This usually means no local tests matched the filter:',
    '  - tests are not annotated with the matching @Txxxxxx IDs in their titles',
    '  - the filter selected tests from another repository or branch',
    '  - the test runner does not support the appended --grep / --testNamePattern option',
    '💡 Hint: run the printed command without the appended filter option to see all your tests,',
    'then annotate them with Testomat IDs.',
  ];
}

export {
  isPlaceholderCommand,
  detectRunner,
  runnerHint,
  buildFilterWarning,
};
