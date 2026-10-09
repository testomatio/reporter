import { expect } from 'chai';
import { fetchLinksFromLogs } from '../../src/adapter/playwright.js';
import { playwrightLogsMarkers } from '../../src/adapter/utils/playwright.js';

describe('Playwright Link Parsing (fetchLinksFromLogs)', () => {
  it('should extract test links from standard log format', () => {
    const stdout = ['[TESTOMATIO-LINK-TEST] ["T12345678", "T87654321"]\n'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.have.length(2);
    expect(links[0]).to.deep.equal({ test: 'T12345678' });
    expect(links[1]).to.deep.equal({ test: 'T87654321' });
    expect(filtered).to.be.empty;
  });

  it('should extract jira links from standard log format', () => {
    const stdout = ['[TESTOMATIO-LINK-JIRA] ["JIRA-101", "PROJ-202"]\n'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.have.length(2);
    expect(links[0]).to.deep.equal({ jira: 'JIRA-101' });
    expect(links[1]).to.deep.equal({ jira: 'PROJ-202' });
    expect(filtered).to.be.empty;
  });

  it('should handle multiple markers in different lines of the same entry', () => {
    const stdout = ['some prefix\n[TESTOMATIO-LINK-TEST] ["T1"]\n[TESTOMATIO-LINK-JIRA] ["J1"]\nsome suffix'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.have.length(2);
    expect(links).to.deep.include({ test: 'T1' });
    expect(links).to.deep.include({ jira: 'J1' });
    expect(filtered).to.have.length(1);
    expect(filtered[0]).to.equal('some prefix\nsome suffix');
  });

  it('should be robust against trailing text after JSON array', () => {
    const stdout = ['[TESTOMATIO-LINK-TEST] ["T123"] extra text here\n'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.have.length(1);
    expect(links[0]).to.deep.equal({ test: 'T123' });
    expect(filtered).to.be.empty;
  });

  it('should handle markers with leading text on the same line', () => {
    const stdout = ['Logged something before [TESTOMATIO-LINK-TEST] ["T456"]\n'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.have.length(1);
    expect(links[0]).to.deep.equal({ test: 'T456' });
    // Note: currently implementation removes the whole line if it contains the marker
    // unless there are other non-marker lines in the same entry.
    // If the line has leading text, it will still be removed from report logs.
    expect(filtered).to.be.empty;
  });

  it('should skip invalid JSON gracefully', () => {
    const stdout = ['[TESTOMATIO-LINK-TEST] invalid-json-here\n', '[TESTOMATIO-LINK-TEST] ["ValidTID"]\n'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.have.length(1);
    expect(links[0]).to.deep.equal({ test: 'ValidTID' });
    expect(filtered).to.be.empty;
  });

  it('should preserve non-string entries in stdout', () => {
    const buffer = Buffer.from('some buffer');
    const stdout = [buffer, 'some string'];
    const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

    expect(links).to.be.empty;
    expect(filtered).to.have.length(2);
    expect(filtered[0]).to.equal(buffer);
    expect(filtered[1]).to.equal('some string');
  });

  describe('label marker', () => {
    it('should extract labels from label marker', () => {
      const stdout = [
        `${playwrightLogsMarkers.label} [{"label": "smoke"}]\n`,
      ];
      const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ label: 'smoke' });
      expect(filtered).to.be.empty;
    });

    it('should extract labels with key-value pairs', () => {
      const stdout = [
        `${playwrightLogsMarkers.label} [{"label": "severity:high"}, {"label": "priority:critical"}]\n`,
      ];
      const { links, stdout: filtered } = fetchLinksFromLogs(stdout);

      expect(links).to.have.length(2);
      expect(links[0]).to.deep.equal({ label: 'severity:high' });
      expect(links[1]).to.deep.equal({ label: 'priority:critical' });
    });

    it('should handle label marker with trailing text', () => {
      const stdout = [
        `${playwrightLogsMarkers.label} [{"label": "smoke"}] extra text\n`,
      ];
      const { links } = fetchLinksFromLogs(stdout);

      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ label: 'smoke' });
    });
  });

  describe('meta marker', () => {
    it('should extract meta data from meta marker', () => {
      const stdout = [
        `${playwrightLogsMarkers.meta} {"build": "123", "env": "staging"}\n`,
      ];
      const { meta, stdout: filtered } = fetchLinksFromLogs(stdout);

      expect(meta).to.deep.equal({ build: '123', env: 'staging' });
      expect(filtered).to.be.empty;
    });

    it('should merge multiple meta markers', () => {
      const stdout = [
        `${playwrightLogsMarkers.meta} {"build": "123"}\n`,
        `${playwrightLogsMarkers.meta} {"env": "staging"}\n`,
      ];
      const { meta } = fetchLinksFromLogs(stdout);

      expect(meta).to.deep.equal({ build: '123', env: 'staging' });
    });

    it('should overwrite meta keys with later values', () => {
      const stdout = [
        `${playwrightLogsMarkers.meta} {"build": "123"}\n`,
        `${playwrightLogsMarkers.meta} {"build": "456"}\n`,
      ];
      const { meta } = fetchLinksFromLogs(stdout);

      expect(meta).to.deep.equal({ build: '456' });
    });

    it('should handle meta marker with trailing text', () => {
      const stdout = [
        `${playwrightLogsMarkers.meta} {"build": "123"} extra text\n`,
      ];
      const { meta } = fetchLinksFromLogs(stdout);

      expect(meta).to.deep.equal({ build: '123' });
    });
  });

  describe('mixed markers', () => {
    it('should extract all types of markers from same output', () => {
      const stdout = [
        `${playwrightLogsMarkers.linkTest} [{"test": "T123"}]\n`,
        `${playwrightLogsMarkers.linkJira} [{"jira": "JIRA-101"}]\n`,
        `${playwrightLogsMarkers.label} [{"label": "smoke"}]\n`,
        `${playwrightLogsMarkers.meta} {"build": "123"}\n`,
      ];
      const { links, meta } = fetchLinksFromLogs(stdout);

      expect(links).to.have.length(3);
      expect(links).to.deep.include({ test: 'T123' });
      expect(links).to.deep.include({ jira: 'JIRA-101' });
      expect(links).to.deep.include({ label: 'smoke' });
      expect(meta).to.deep.equal({ build: '123' });
    });
  });
});
