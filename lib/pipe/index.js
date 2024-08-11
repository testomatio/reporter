import fs from 'fs';
import path from 'path';
import chalk from '../utils/chalk.js';
import { APP_PREFIX } from '../constants.js';
import TestomatioPipe from './testomatio.js';
import GitHubPipe from './github.js';
import GitLabPipe from './gitlab.js';
import CsvPipe from './csv.js';
import HtmlPipe from './html.js';

export async function pipesFactory(params, opts) {
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
        PipeClass = await import(pipeDef);
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
