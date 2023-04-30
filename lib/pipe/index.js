import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { APP_PREFIX } from '../constants';
import TestomatioPipe from './testomatio';
import GitHubPipe from './github';
import GitLabPipe from './gitlab';
import CsvPipe from './csv';

export default function (params, opts) {
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
