#!/usr/bin/env node
const { spawn } = require("child_process");
const program = require("commander");
const chalk = require("chalk");
const TestomatClient = require("../client");
const { APP_PREFIX } = require("../constants");

const apiKey = process.env["INPUT_TESTOMATIO-KEY"] || process.env.TESTOMATIO;
const title = process.env.TESTOMATIO_TITLE;

program.option("-c, --command <cmd>", "Test command").action((opts) => {
  const { command } = opts;
  const testCmds = command.split(" ");
  console.log(APP_PREFIX, `🚀 Running`, chalk.green(command));

  if (!apiKey) {
    const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: "inherit" });

    cmd.on("close", (code) => {
      console.log(
        APP_PREFIX,
        "⚠️ ",
        `Runner exited with ${chalk.bold(code)}, report is ignored`
      );
      process.exitCode = code;
    });

    return;
  }

  const client = new TestomatClient({ apiKey, title, parallel: true });

  client.createRun().then(() => {
    const cmd = spawn(testCmds[0], testCmds.slice(1), { stdio: "inherit" });

    cmd.on("close", (code) => {
      const emoji = code === 0 ? "🟢" : "🔴";
      console.log(APP_PREFIX, emoji, `Runner exited with ${chalk.bold(code)}`);
      const status = code === 0 ? "passed" : "failed";
      client.updateRunStatus(status, true);
      process.exitCode = code;
    });
  });
});

if (process.argv.length <= 2) {
  program.outputHelp();
}

program.parse(process.argv);
