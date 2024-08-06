const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { APP_PREFIX } = require('../constants');
const TestomatioPipe = require('./testomatio');
const GitHubPipe = require('./github');
const GitLabPipe = require('./gitlab');
const CsvPipe = require('./csv');
const HtmlPipe = require('./html');

function PipeFactory(params, opts) {
  const extraPipes = [];

  // Add extra pipes into package.json file:
  // "testomatio": {
  //   "pipes": ["my-module-pipe", "./local/js/file/pipe"]
  // }

  const packageJsonFile = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonFile)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFile).toString());
    const pipeDefs = packageJson?.testomatio?.pipes || [];

    for (const pipeDef of pipeDefs) {
      let PipeClass;
      try {
        PipeClass = require(pipeDef);
      } catch (err) {
        console.log(APP_PREFIX, `Can't load module Testomatio pipe module from ${pipeDef}`);
        continue;
      }

      try {
        extraPipes.push(new PipeClass(params, opts));
      } catch (err) {
        console.log(APP_PREFIX, `Can't instantiate Testomatio for ${pipeDef}`, err);
        continue;
      }
    }
  }

  const pipes = [
    new TestomatioPipe(params, opts),
    new GitHubPipe(params, opts),
    new GitLabPipe(params, opts),
    new CsvPipe(params, opts),
    new HtmlPipe(params, opts),
    ...extraPipes,
  ];

  console.log(
    APP_PREFIX,
    chalk.cyan('Pipes:'),
    chalk.cyan(
      pipes
        .filter(p => p.isEnabled)
        .map(p => p.toString())
        .join(', ') || 'No pipes enabled',
    ),
  );

  return pipes;
}

module.exports = PipeFactory;
