import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { APP_PREFIX } from '../constants.js';
import TestomatioPipe from './testomatio.js';
import GitHubPipe from './github.js';
import GitLabPipe from './gitlab.js';
import CsvPipe from './csv.js';
import HtmlPipe from './html.js';
import { BitbucketPipe } from './bitbucket.js';
import { DebugPipe } from './debug.js';

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
    new BitbucketPipe(params, opts),
    new DebugPipe(params, opts),
    ...extraPipes,
  ];

  const pipesEnabled = pipes.filter(p => p.isEnabled);

  console.log(
    APP_PREFIX,
    pc.cyan('Pipes:'),
    pc.cyan(pipesEnabled.map(p => p.toString()).join(', ') || 'No pipes enabled'),
  );

  if (!pipesEnabled.length) {
    console.log(
      APP_PREFIX,
      pc.dim('If you want to use Testomatio reporter, pass your token as TESTOMATIO env variable'),
    );
  }

  return pipes;
}
