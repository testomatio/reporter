import createDebugMessages from 'debug';
import merge from 'lodash.merge';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import fileUrl from 'file-url';
import { fileSystem, isSameTest, ansiRegExp } from '../utils/utils.js';
import { MARKDOWN_REPORT } from '../constants.js';

const debug = createDebugMessages('@testomatio/reporter:pipe:markdown');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

class MarkdownPipe {
  constructor(params, store = {}) {
    this.store = store || {};
    this.title = params.title || process.env.TESTOMATIO_TITLE;
    this.apiKey = params.apiKey || process.env.TESTOMATIO;
    this.isMarkdown = process.env.TESTOMATIO_MARKDOWN_REPORT_SAVE;

    debug('Markdown Pipe: ', this.apiKey ? 'API KEY' : '*no api key provided*');

    this.isEnabled = false;
    this.markdownOutputPath = '';
    this.filenameMsg = '';
    this.tests = [];

    if (!this.isMarkdown) return;

    this.isEnabled = true;
    this.markdownReportDir = process.env.TESTOMATIO_MARKDOWN_REPORT_FOLDER || MARKDOWN_REPORT.FOLDER;

    const envName = process.env.TESTOMATIO_MARKDOWN_FILENAME;
    if (envName && envName.endsWith('.md')) {
      this.markdownReportName = envName;
    } else if (envName) {
      this.markdownReportName = MARKDOWN_REPORT.REPORT_DEFAULT_NAME;
      this.filenameMsg =
        'Markdown filename must include the extension ".md".' +
        ` The default report name "${this.markdownReportDir}/${MARKDOWN_REPORT.REPORT_DEFAULT_NAME}" is used!`;
    } else {
      this.markdownReportName = MARKDOWN_REPORT.REPORT_DEFAULT_NAME;
    }

    this.markdownOutputPath = path.join(this.markdownReportDir, this.markdownReportName);
    fileSystem.createDir(this.markdownReportDir);

    debug(
      pc.yellow('Markdown Pipe:'),
      `Save Markdown report: ${this.isEnabled}`,
      `Markdown report folder: ${this.markdownReportDir}, report name: ${this.markdownReportName}`,
    );
  }

  async createRun() {
    // empty
  }

  async prepareRun() {}

  updateRun() {
    // empty
  }

  /**
   * @param {import('../../types/types.js').MarkdownTestData} test
   */
  addTest(test) {
    if (!this.isEnabled) return;

    if (test?.stack && typeof test.stack === 'string') {
      test.stack = test.stack.replace(ansiRegExp(), '');
    }

    const hasPayload =
      Boolean(test?.status) ||
      (Array.isArray(test?.files) && test.files.length) ||
      (Array.isArray(test?.artifacts) && test.artifacts.length) ||
      (Array.isArray(test?.steps) && test.steps.length) ||
      Boolean(test?.message) ||
      Boolean(test?.logs) ||
      (test?.meta &&
        ((Array.isArray(test.meta.attachments) && test.meta.attachments.length) || test.meta.traces !== undefined));

    if (!hasPayload) return;

    const index = this.tests.findIndex(t => isSameTest(t, test));
    if (index >= 0) {
      this.tests[index] = merge(this.tests[index], test);
      return;
    }

    this.tests.push(test);
  }

  async finishRun(runParams) {
    if (!this.isEnabled) return;

    this.buildReport({
      runParams,
      tests: this.tests,
      outputPath: this.markdownOutputPath,
      warningMsg: this.filenameMsg,
    });
  }

  buildReport(opts) {
    const { runParams, tests, outputPath, warningMsg: msg } = opts;

    debug('Markdown tests data:', tests);

    if (!outputPath) {
      console.log(pc.yellow(`🚨 Markdown export path is not set, ignoring...`));
      return;
    }

    console.log(pc.yellow(`⏳ The test results will be added to the Markdown report. It will take some time...`));

    if (msg) {
      console.log(pc.blue(msg));
    }

    const aggregated = aggregateTestRetries(tests);
    const stats = computeStats(aggregated);

    const data = {
      title: this.title || 'Test Results',
      runId: this.store.runId || '',
      runUrl: this.store.runUrl || '',
      status: runParams?.status || 'unknown',
      isParallel: runParams?.isParallel,
      executionTime: testExecutionSumTime(aggregated),
      executionDate: getCurrentDateTimeFormatted(),
      tests: aggregated,
      stats,
      envVars: collectEnvironmentVariables(),
    };

    const md = renderDocument(data);

    fs.writeFileSync(outputPath, md, 'utf-8');

    if (fs.existsSync(outputPath)) {
      const absolutePath = path.resolve(outputPath);
      const fileUrlPath = fileUrl(absolutePath, { resolve: true });
      debug('Markdown report path:', fileUrlPath);
      console.log(pc.green(`📝 The Markdown report was successfully generated. Full filepath: ${fileUrlPath}`));
    } else {
      console.log(pc.red(`🚨 Failed to generate the Markdown report.`));
    }
  }

  async sync() {
    // MarkdownPipe doesn't buffer, no-op
  }

  toString() {
    return 'Markdown Reporter';
  }
}

function renderDocument(data) {
  const sections = [];
  sections.push(renderHeader(data));
  sections.push(renderEnvSection(data.envVars));
  sections.push(renderTests(data.tests));
  return sections.filter(Boolean).join('\n\n') + '\n';
}

function renderHeader(data) {
  const overall = String(data.status || 'unknown').toLowerCase();
  const headline = `# ${data.title} — ${overall.toUpperCase()}`;

  const s = data.stats;
  const summaryTable = [
    '## Summary',
    '',
    '| Total | Passed | Failed | Skipped | Todo | Flaky |',
    '| ----- | ------ | ------ | ------- | ---- | ----- |',
    `| ${s.total} | ${s.passed} | ${s.failed} | ${s.skipped} | ${s.todo} | ${s.flaky} |`,
  ].join('\n');

  const runInfo = renderRunInfoBullets(data);

  return `${headline}\n\n${summaryTable}\n\n${runInfo}`;
}

function renderRunInfoBullets(data) {
  const bullets = [];
  bullets.push(`- **Status:** ${mdInline(data.status || 'unknown')}`);
  if (data.runId) bullets.push(`- **Run ID:** \`${mdInline(data.runId)}\``);
  if (data.runUrl) bullets.push(`- **Run URL:** <${data.runUrl}>`);
  bullets.push(`- **Started:** ${mdInline(data.executionDate)}`);
  bullets.push(`- **Duration:** \`${mdInline(data.executionTime)}\``);

  let parallelLabel = 'No parallel info';
  if (data.isParallel === true) parallelLabel = 'true';
  else if (data.isParallel === false) parallelLabel = 'false';
  bullets.push(`- **Parallel:** ${parallelLabel}`);

  return bullets.join('\n');
}

function renderEnvSection(envVars) {
  if (!envVars) return '';

  const blocks = ['## Environment'];

  const groups = [
    { title: 'Testomat.io variables', vars: envVars.testomatio || {} },
    { title: 'S3 variables', vars: envVars.s3 || {} },
  ];

  for (const group of groups) {
    const entries = Object.entries(group.vars).filter(([, v]) => v && v.isSet);
    if (!entries.length) continue;

    entries.sort((a, b) => a[0].localeCompare(b[0]));

    const lines = [];
    lines.push('<details>');
    lines.push(`<summary>${group.title} (${entries.length})</summary>`);
    lines.push('');
    lines.push('| Variable | Value |');
    lines.push('| -------- | ----- |');
    for (const [name, info] of entries) {
      lines.push(`| \`${name}\` | ${mdTableCell(String(info.value ?? ''))} |`);
    }
    lines.push('');
    lines.push('</details>');

    blocks.push(lines.join('\n'));
  }

  if (blocks.length === 1) return '';
  return blocks.join('\n\n');
}

function renderTests(tests) {
  if (!Array.isArray(tests) || tests.length === 0) {
    return '## Tests\n\n_No test results recorded._';
  }

  const bySuite = new Map();
  for (const test of tests) {
    let suite = test.suite_title;
    if (typeof suite !== 'string' || !suite.trim()) {
      suite = 'Unknown suite';
    }
    if (!bySuite.has(suite)) bySuite.set(suite, []);
    bySuite.get(suite).push(test);
  }

  const blocks = ['## Tests'];

  for (const [suite, suiteTests] of bySuite) {
    blocks.push(`### Suite: ${mdInline(suite)}`);
    for (const test of suiteTests) {
      blocks.push(renderTest(test));
    }
  }

  return blocks.join('\n\n');
}

function renderTest(test) {
  let title = test.title;
  if (typeof title !== 'string' || !title.trim()) {
    title = 'Unknown test title';
  }

  const status = normalizeStatus(test.status);
  let displayStatus = status;
  if ((status === 'skipped' || status === 'pending') && test.meta?.todo) {
    displayStatus = 'todo';
  }

  const duration = formatStepDuration(test.run_time);
  let header = `#### ${mdInline(title)}`;
  if (duration) header += ` — ${duration}`;

  const lines = [header];

  const meta = [`- **Status:** ${displayStatus}`];

  const retries = computeRetries(test);
  if (retries.retryCount > 0) {
    let retryLine = `- **Retries:** ${retries.retryCount}`;
    if (retries.flaky) retryLine += ' (flaky)';
    meta.push(retryLine);
  }
  if (typeof test.test_id === 'string' && test.test_id) {
    meta.push(`- **Test ID:** \`${test.test_id}\``);
  }
  lines.push(meta.join('\n'));

  const metaBlock = renderTestMeta(test);
  if (metaBlock) lines.push(metaBlock);

  const stepsBlock = renderSteps(test);
  if (stepsBlock) lines.push(stepsBlock);

  const messageBlock = renderMessage(test);
  if (messageBlock) lines.push(messageBlock);

  const stackBlock = renderStack(test);
  if (stackBlock) lines.push(stackBlock);

  const logsBlock = renderLogs(test);
  if (logsBlock) lines.push(logsBlock);

  const artifactsBlock = renderArtifacts(test);
  if (artifactsBlock) lines.push(artifactsBlock);

  return lines.join('\n\n');
}

// Keys on test.meta that aren't user-defined metadata (carry reporter internals
// or are surfaced elsewhere in the report). Excluded from the **Meta** section.
const META_INTERNAL_KEYS = new Set([
  'attachments',
  'logs',
  'console',
  'stdout',
  'stderr',
  'traces',
  'todo',
  'retryCount',
  'flaky',
  'isFlaky',
  'rid',
  'RID',
  'runRid',
  'testRid',
]);

function renderTestMeta(test) {
  const meta = test?.meta;
  if (!meta || typeof meta !== 'object') return '';

  const entries = Object.entries(meta).filter(([k, v]) => {
    if (META_INTERNAL_KEYS.has(k)) return false;
    if (v === null || v === undefined) return false;
    if (typeof v === 'string' && !v.trim()) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  if (!entries.length) return '';

  entries.sort((a, b) => a[0].localeCompare(b[0]));

  const bullets = entries.map(([k, v]) => `- \`${k}\`: ${formatMetaValue(v)}`);
  return `**Meta**\n\n${bullets.join('\n')}`;
}

function formatMetaValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return mdInline(value);
  try {
    return `\`${JSON.stringify(value)}\``;
  } catch (_) {
    return String(value);
  }
}

function renderSteps(test) {
  const steps = test.steps;

  if (Array.isArray(steps) && steps.length > 0) {
    const userSteps = filterUserStepsTree(steps);
    const tree = userSteps.length ? userSteps : steps;
    const bullets = renderStepTree(tree, 0);
    if (!bullets) return '';
    return `**Steps**\n\n${bullets}`;
  }

  if (typeof steps === 'string' && steps.trim()) {
    const cleaned = steps.replace(ansiRegExp(), '').trim();
    return `**Steps**\n\n${fence(cleaned)}`;
  }

  return '';
}

function renderStepTree(steps, depth) {
  const indent = '  '.repeat(depth);
  const lines = [];
  for (const step of steps) {
    if (!step) continue;
    let title = step.title;
    if (typeof title !== 'string') title = String(title ?? '');
    title = title.replace(ansiRegExp(), '').trim();
    if (!title) continue;

    const dur = formatStepDuration(step.duration);
    let bullet = `${indent}- ${mdInline(title)}`;
    if (dur) bullet += ` _(${dur})_`;
    if (step.error) bullet += ' **[failed]**';
    lines.push(bullet);

    if (Array.isArray(step.steps) && step.steps.length) {
      const nested = renderStepTree(step.steps, depth + 1);
      if (nested) lines.push(nested);
    }
  }
  return lines.join('\n');
}

function filterUserStepsTree(steps) {
  if (!Array.isArray(steps)) return [];

  const isUserStep = s => String(s?.category || '').toLowerCase() === 'user';

  const walk = arr => {
    const out = [];
    for (const s of arr) {
      if (!s) continue;
      const children = walk(s.steps || []);
      if (isUserStep(s)) {
        const copy = { ...s };
        if (children.length) copy.steps = children;
        else delete copy.steps;
        out.push(copy);
      } else if (children.length) {
        out.push(...children);
      }
    }
    return out;
  };

  return walk(steps);
}

function renderMessage(test) {
  if (!test.message) return '';
  const cleaned = String(test.message).replace(ansiRegExp(), '').trim();
  if (!cleaned) return '';
  const blockquote = cleaned
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  return `**Message**\n\n${blockquote}`;
}

function renderStack(test) {
  if (!test.stack) return '';
  const cleaned = String(test.stack).replace(ansiRegExp(), '').trim();
  if (!cleaned) return '';
  return `**Stack Trace**\n\n${fence(cleaned)}`;
}

function renderLogs(test) {
  const sources = [test.logs, test.meta?.logs, test.meta?.console, test.meta?.stdout, test.meta?.stderr];
  let raw = '';
  for (const s of sources) {
    if (s && String(s).trim()) {
      raw = String(s);
      break;
    }
  }
  if (!raw) return '';
  const cleaned = raw.replace(ansiRegExp(), '').trim();
  if (!cleaned) return '';
  return `**Logs**\n\n${fence(cleaned)}`;
}

function renderArtifacts(test) {
  const all = [
    ...(Array.isArray(test.artifacts) ? test.artifacts : []),
    ...(Array.isArray(test.files) ? test.files : []),
    ...(test.meta && Array.isArray(test.meta.attachments) ? test.meta.attachments : []),
    ...(Array.isArray(test.manuallyAttachedArtifacts) ? test.manuallyAttachedArtifacts : []),
  ];

  const items = [];
  const seen = new Set();

  for (const raw of all) {
    const item = normalizeArtifact(raw);
    if (!item) continue;
    if (isTraceZip(item)) continue;
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    items.push(item);
  }

  if (!items.length) return '';

  const lines = ['**Artifacts**', ''];
  for (const item of items) {
    if (item.isImage) {
      lines.push(`- ![${mdInline(item.name)}](${item.href})`);
    } else {
      lines.push(`- [${mdInline(item.name)}](${item.href})`);
    }
  }
  return lines.join('\n');
}

function normalizeArtifact(raw) {
  if (raw == null) return null;

  if (typeof raw === 'string') {
    if (!raw.trim()) return null;
    if (/^https?:\/\//i.test(raw)) {
      let base = raw;
      try {
        base = path.basename(new URL(raw).pathname) || raw;
      } catch (_) {
        base = raw;
      }
      return { name: base, href: raw, isImage: looksLikeImage(raw) };
    }
    const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    let href = raw;
    if (raw.startsWith('file://')) {
      href = raw;
    } else {
      href = fileUrl(abs, { resolve: true });
    }
    return { name: path.basename(abs), href, isImage: looksLikeImage(abs) };
  }

  const rawPath = raw.path || raw.link || raw.url;
  if (!rawPath || typeof rawPath !== 'string') return null;

  const isHttp = /^https?:\/\//i.test(rawPath);
  const isFileUrl = rawPath.startsWith('file://');
  let href;
  let name;

  if (isHttp || isFileUrl) {
    href = rawPath;
    if (raw.name) {
      name = raw.name;
    } else if (raw.title) {
      name = raw.title;
    } else if (isHttp) {
      try {
        name = path.basename(new URL(rawPath).pathname) || 'attachment';
      } catch (_) {
        name = 'attachment';
      }
    } else {
      name = path.basename(rawPath.replace(/^file:\/\//, '')) || 'attachment';
    }
  } else {
    const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
    href = fileUrl(abs, { resolve: true });
    name = raw.name || raw.title || path.basename(abs);
  }

  let isImage = false;
  if (typeof raw.type === 'string' && raw.type.toLowerCase().startsWith('image/')) {
    isImage = true;
  } else {
    isImage = looksLikeImage(rawPath);
  }

  return { name, href, isImage };
}

function looksLikeImage(p) {
  if (typeof p !== 'string') return false;
  const lower = p.toLowerCase().split('?')[0].split('#')[0];
  return IMAGE_EXTS.some(ext => lower.endsWith(ext));
}

function isTraceZip(item) {
  if (!item) return false;
  const isTraceName = item.name === 'trace' || item.name === 'trace.zip';
  const isZip = typeof item.href === 'string' && item.href.toLowerCase().split('?')[0].endsWith('.zip');
  return isTraceName && isZip;
}

function fence(text, lang = '') {
  const content = String(text).replace(/\r\n/g, '\n');
  let ticks = '```';
  while (content.includes(ticks)) {
    ticks += '`';
  }
  if (lang) {
    return `${ticks}${lang}\n${content}\n${ticks}`;
  }
  return `${ticks}\n${content}\n${ticks}`;
}

function mdInline(text) {
  if (text == null) return '';
  return String(text).replace(/\r?\n/g, ' ').trim();
}

function mdTableCell(text) {
  if (text == null) return '';
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
}

function formatStepDuration(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return '';
  if (value < 1000) return `${value}ms`;
  const seconds = Math.floor(value / 1000);
  const ms = value % 1000;
  if (ms === 0) return `${seconds}s`;
  return `${seconds}s ${ms}ms`;
}

function computeStats(tests) {
  const stats = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, flaky: 0 };
  if (!Array.isArray(tests)) return stats;

  for (const test of tests) {
    stats.total += 1;
    let status = normalizeStatus(test.status);
    if ((status === 'skipped' || status === 'pending') && test.meta?.todo) {
      status = 'todo';
    }
    if (status === 'pending') status = 'todo';

    if (status === 'passed') stats.passed += 1;
    else if (status === 'failed') stats.failed += 1;
    else if (status === 'skipped') stats.skipped += 1;
    else if (status === 'todo') stats.todo += 1;

    if (test.flaky === true) stats.flaky += 1;
  }
  return stats;
}

function computeRetries(test) {
  const fromObj = test.retries;
  let retryCount = 0;
  let flaky = Boolean(test.flaky);

  if (fromObj && typeof fromObj === 'object') {
    if (typeof fromObj.retryCount === 'number') retryCount = fromObj.retryCount;
    if (Array.isArray(fromObj.attempts)) {
      retryCount = Math.max(retryCount, fromObj.attempts.length - 1);
    }
    if (fromObj.passedAfterRetries) flaky = true;
  }

  if (test.meta && typeof test.meta.retryCount === 'number') {
    retryCount = Math.max(retryCount, test.meta.retryCount);
  }

  return { retryCount, flaky };
}

function normalizeStatus(value) {
  const s = String(value || '').toLowerCase();
  if (s === 'pending') return 'pending';
  if (!s) return 'unknown';
  return s;
}

function testExecutionSumTime(tests) {
  if (!Array.isArray(tests)) return '0h 0m 0s 0ms';
  const totalMs = tests.reduce((sum, test) => {
    if (typeof test.run_time === 'number' && !Number.isNaN(test.run_time)) {
      return sum + test.run_time;
    }
    return sum;
  }, 0);
  return formatDuration(totalMs);
}

function formatDuration(duration) {
  const ms = duration % 1000;
  let rest = (duration - ms) / 1000;
  const seconds = rest % 60;
  rest = (rest - seconds) / 60;
  const minutes = rest % 60;
  const hours = (rest - minutes) / 60;
  return `${hours}h ${minutes}m ${seconds}s ${ms}ms`;
}

function getCurrentDateTimeFormatted() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `(${date} ${time})`;
}

function aggregateTestRetries(tests) {
  if (!Array.isArray(tests) || tests.length === 0) return tests || [];

  const grouped = new Map();
  for (const t of tests) {
    const rid = t?.rid || t?.meta?.rid || t?.meta?.RID || t?.meta?.runRid || t?.meta?.testRid;
    let key;
    if (rid) {
      key = `rid:${rid}`;
    } else {
      key = `ft:${t?.file || ''}|${t?.title || ''}`;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(t);
  }

  const aggregated = [];
  grouped.forEach(group => {
    if (group.length === 1) {
      aggregated.push(group[0]);
      return;
    }

    const attemptsOnly = group.filter(x => x && x.status);
    let base;
    if (attemptsOnly.length) {
      base = attemptsOnly[attemptsOnly.length - 1];
    } else {
      base = group[group.length - 1];
    }

    const allFiles = [];
    const allArtifacts = [];
    const allMetaAttachments = [];
    const allManual = [];

    for (const x of group) {
      if (Array.isArray(x?.files)) allFiles.push(...x.files);
      if (Array.isArray(x?.artifacts)) allArtifacts.push(...x.artifacts);
      if (Array.isArray(x?.meta?.attachments)) allMetaAttachments.push(...x.meta.attachments);
      if (Array.isArray(x?.manuallyAttachedArtifacts)) allManual.push(...x.manuallyAttachedArtifacts);
    }

    const attempts = attemptsOnly.map(a => ({
      status: normalizeStatus(a.status),
      duration: a.run_time || a.time || 0,
    }));

    const retryCount = Math.max(0, attempts.length - 1);
    const hadFailures = attempts.slice(0, -1).some(a => a.status === 'failed');
    const finalStatus = normalizeStatus(base.status);
    const passedAfterRetries = finalStatus === 'passed' && hadFailures;

    const merged = merge({}, base);
    if (allFiles.length) merged.files = allFiles;
    if (allArtifacts.length) merged.artifacts = allArtifacts;
    merged.meta = merged.meta || {};
    if (allMetaAttachments.length) {
      merged.meta.attachments = [...(merged.meta.attachments || []), ...allMetaAttachments];
    }
    if (allManual.length) {
      merged.manuallyAttachedArtifacts = [...(merged.manuallyAttachedArtifacts || []), ...allManual];
    }

    merged.retries = { retryCount, attempts, hadFailures, passedAfterRetries, finalStatus };
    merged.flaky = Boolean(passedAfterRetries || merged.meta?.flaky || merged.meta?.isFlaky);

    aggregated.push(merged);
  });

  return aggregated;
}

const SENSITIVE_PATTERNS = [/TOKEN/, /SECRET/, /PASSWORD/, /KEY$/, /^TESTOMATIO$/];

function isSensitiveVarName(name) {
  return SENSITIVE_PATTERNS.some(re => re.test(name));
}

function collectEnvironmentVariables() {
  const groups = { testomatio: {}, s3: {} };

  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue;

    let group = null;
    if (name === 'TESTOMATIO' || name.startsWith('TESTOMATIO_')) group = 'testomatio';
    else if (name.startsWith('S3_')) group = 's3';
    if (!group) continue;

    let displayValue = value;
    if (isSensitiveVarName(name)) displayValue = '***';

    groups[group][name] = { value: displayValue, isSet: true };
  }

  return groups;
}

export default MarkdownPipe;
