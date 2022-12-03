const fs = require('fs');
const path = require('path');
const { APP_PREFIX } = require('../constants');
const TestomatioPipe = require('./testomatio');
const GitHubPipe = require('./github');

module.exports = function(params, opts) {
  const extraPipes = [];

  // Add extra pipes into package.json file:
  // "testomatio": {
  //   "pipes": ["my-module-pipe", "./local/js/file/pipe"] 
  // }

  const packageJsonFile = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonFile)) {
    const package = fs.readFileSync(packageJsonFile);
    const pipeDefs = package?.testomatio?.pipes || [];
    
    for (const pipeDef of pipeDefs) {
      let pipeClass;
      try {
        pipeClass = require(pipeDef);
      } catch (err) {
        console.log(APP_PREFIX, `Can't load module Testomatio pipe module from ${pipeDef}`);
        continue;
      }

      try {
        extraPipes.push(new pipeClass(params, opts))
      } catch (err) {
        console.log(APP_PREFIX, `Can't instantiate Testomatio for ${pipeDef}`, err);
        continue;
      }
    }
  }
  

  const pipes = [
    new TestomatioPipe(params, opts),
    new GitHubPipe(params, opts),    
    ...extraPipes
  ];

  console.log(APP_PREFIX, pipes.filter(p => p.isEnabled).map(p => p.toString()).join(', ') || "No pipe reporters enabled");

  return pipes;
}
