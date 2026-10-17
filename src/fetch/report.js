import { renderTests } from '../pipe/markdown.js';

const TITLE_SEPARATOR = ' ⇒ ';

/**
 * Map a testrun of API v2 to the test shape of the Markdown pipe.
 * Without a suite, the API returns the title as "<suite> ⇒ <title>".
 *
 * @param {object} testrun
 * @returns {object}
 */
function toReportTest(testrun) {
  let title = String(testrun.test_title || '').trim();
  let suite = testrun.suiteTitle;

  if (!suite && title.includes(TITLE_SEPARATOR)) {
    const [suitePart, ...titleParts] = title.split(TITLE_SEPARATOR);
    suite = suitePart.trim();
    title = titleParts.join(TITLE_SEPARATOR).trim();
  }

  return {
    title,
    suite_title: suite,
    status: testrun.status,
    run_time: testrun.run_time,
    test_id: testrun.testId,
    message: testrun.message,
    stack: testrun.stack,
    artifacts: testrun.artifacts,
  };
}

/**
 * Render a fetched run with its testruns as a Markdown report.
 *
 * @param {object} params
 * @param {object} params.run - Run from GET /api/v2/:project/runs/:id
 * @param {string} params.runUrl
 * @param {{total: number, byStatus: Record<string, number>}} params.summary - Counts of all testruns of the run
 * @param {object[]} params.testruns
 * @param {number} params.matched - Number of testruns matching the filter
 * @param {string[]} params.statuses - Status filter, empty for all testruns
 * @returns {string}
 */
function renderRunReport({ run, runUrl, summary, testruns, matched, statuses }) {
  const status = String(run.status || 'unknown');
  const sections = [`# ${run.title || run.id} — ${status.toUpperCase()}`];

  const rows = [
    ['Run ID', `\`${run.id}\``],
    ['Run URL', `<${runUrl}>`],
    ['Status', status],
  ];
  if (run.env) rows.push(['Environment', run.env]);
  if (run.launched_at) rows.push(['Started', run.launched_at]);
  if (run.finished_at) rows.push(['Finished', run.finished_at]);

  let shown = `${testruns.length} of ${matched} shown`;
  if (statuses.length) shown += ` (only: ${statuses.join(', ')})`;
  rows.push(['Testruns', shown]);

  sections.push(
    ['| Key | Value |', '| --- | ----- |', ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join('\n'),
  );

  if (run.description?.trim()) sections.push(`## Description\n\n${run.description.trim()}`);

  const counts = Object.entries(summary.byStatus).sort(([, a], [, b]) => b - a);
  sections.push(
    [
      '## Summary',
      '',
      '| Status | Count |',
      '| ------ | ----- |',
      ...counts.map(([name, count]) => `| ${name} | ${count} |`),
      `| total | ${summary.total} |`,
    ].join('\n'),
  );

  sections.push(renderTests(testruns.map(toReportTest)));

  return `${sections.join('\n\n')}\n`;
}

export { renderRunReport, toReportTest };
