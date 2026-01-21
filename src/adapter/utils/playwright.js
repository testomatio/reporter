import createDebugMessages from 'debug';
const debug = createDebugMessages('@testomatio/reporter:adapter-playwright-utils');

export const playwrightLogsMarkers = {
  label: '[TESTOMATIO-LABEL]',
  meta: '[TESTOMATIO-META]',
  linkTest: '[TESTOMATIO-LINK-TEST]',
  linkJira: '[TESTOMATIO-LINK-JIRA]',
};

/**
 * Fetches links from stdout. Returns links and filtered stdout (without data containing markers)
 *
 * @param {(string | Buffer)[]} stdout
 * @returns {{ links: { [key: 'test' | 'jira' | 'label']: string }[], meta: { [key: string]: any }, stdout: (string | Buffer)[] }}
 */
export function fetchLinksFromLogs(stdout) {
  const links = [];
  const meta = {};

  const markers = [
    { key: playwrightLogsMarkers.linkTest, type: 'test' },
    { key: playwrightLogsMarkers.linkJira, type: 'jira' },
    { key: playwrightLogsMarkers.label, type: 'label' },
    { key: playwrightLogsMarkers.meta, type: 'meta' },
  ];

  const filteredStdout = [];

  stdout.forEach(entry => {
    if (typeof entry !== 'string') {
      filteredStdout.push(entry);
      return;
    }

    // check if entry contains any of markers
    if (!markers.some(m => entry.includes(m.key))) {
      filteredStdout.push(entry);
      return;
    }

    const newEntryLines = [];
    entry.split('\n').forEach(line => {
      line = line.trim();
      let hasMarker = false;
      for (const marker of markers) {
        // links (test/jira/label) stored as array of objects
        if (line.includes(marker.key)) {
          hasMarker = true;
          try {
            const rawData = line.split(marker.key)[1]?.trim();
            if (!rawData) continue;

            let data;
            try {
              data = JSON.parse(rawData);
            } catch (e) {
              // Fallback: treat raw data as single element array
              data = [rawData];
            }

            if (marker.type === 'meta') {
              // meta stored as an object, thus make it similar to links
              Object.assign(meta, data);
            } else {
              const ids = Array.isArray(data) ? data : [data];
              links.push(
                ...ids
                  // filter non-truthy ids
                  .filter(id => !!id)
                  .map(id => ({
                    // marker type is either 'test' or 'jira' or 'label'
                    [marker.type]: id,
                  })),
              );
            }
          } catch (e) {
            debug('Error parsing links from string:', line, '\n', e);
          }
        }
      }
      if (!hasMarker && line) {
        newEntryLines.push(line);
      }
    });

    if (newEntryLines.length) {
      filteredStdout.push(newEntryLines.join('\n'));
    }
  });

  return {
    stdout: filteredStdout,
    links,
    meta,
  };
}
