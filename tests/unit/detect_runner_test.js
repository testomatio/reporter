import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isPlaceholderCommand, detectRunner, runnerHint, buildFilterWarning } from '../../src/utils/detectRunner.js';

const fixtureDirs = [];

function makeFixtureDir(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testomatio-detect-'));
  fixtureDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

describe('detectRunner', () => {
  after(() => {
    for (const dir of fixtureDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('#isPlaceholderCommand', () => {
    it('detects placeholder commands copied from Testomat.io examples', () => {
      expect(isPlaceholderCommand('<run tests>')).to.be.true;
      expect(isPlaceholderCommand('<test command>')).to.be.true;
      expect(isPlaceholderCommand('<your-command>')).to.be.true;
      expect(isPlaceholderCommand('run tests')).to.be.true;
      expect(isPlaceholderCommand('Run Tests')).to.be.true;
      expect(isPlaceholderCommand('your test command')).to.be.true;
      expect(isPlaceholderCommand('--run tests>')).to.be.true;
    });

    it('does not reject valid commands', () => {
      expect(isPlaceholderCommand('npx playwright test')).to.be.false;
      expect(isPlaceholderCommand('npm test')).to.be.false;
      expect(isPlaceholderCommand('npm run tests')).to.be.false;
      expect(isPlaceholderCommand('node ./run.js')).to.be.false;
      expect(isPlaceholderCommand('yarn jest')).to.be.false;
      expect(isPlaceholderCommand('npx wdio run ./wdio.conf.js')).to.be.false;
      expect(isPlaceholderCommand('')).to.be.false;
    });
  });

  describe('#detectRunner', () => {
    it('detects Playwright by config file only', () => {
      const dir = makeFixtureDir({ 'playwright.config.js': '' });
      expect(detectRunner(dir)).to.deep.equal({ name: 'Playwright', command: 'npx playwright test' });
    });

    it('detects Jest by devDependency only', () => {
      const dir = makeFixtureDir({
        'package.json': JSON.stringify({ devDependencies: { jest: '^29' } }),
      });
      expect(detectRunner(dir)).to.deep.equal({ name: 'Jest', command: 'npx jest' });
    });

    it('suggests the found wdio config file for WebdriverIO', () => {
      const dir = makeFixtureDir({
        'package.json': JSON.stringify({ devDependencies: { '@wdio/local-runner': '^8' } }),
        'wdio.conf.ts': '',
      });
      expect(detectRunner(dir)).to.deep.equal({ name: 'WebdriverIO', command: 'npx wdio run ./wdio.conf.ts' });
    });

    it('detects Cypress by dependency', () => {
      const dir = makeFixtureDir({
        'package.json': JSON.stringify({ devDependencies: { cypress: '^13' } }),
      });
      expect(detectRunner(dir)).to.deep.equal({ name: 'Cypress', command: 'npx cypress run' });
    });

    it('returns null in a directory without any runner markers', () => {
      const dir = makeFixtureDir();
      expect(detectRunner(dir)).to.be.null;
    });

    it('returns null on a malformed package.json without throwing', () => {
      const dir = makeFixtureDir({ 'package.json': '{ not json' });
      expect(detectRunner(dir)).to.be.null;
    });
  });

  describe('#runnerHint', () => {
    it('suggests the detected runner command', () => {
      const dir = makeFixtureDir({ 'playwright.config.ts': '' });
      expect(runnerHint(dir)).to.include('Playwright').and.to.include('npx playwright test');
    });

    it('falls back to a generic example', () => {
      const dir = makeFixtureDir();
      expect(runnerHint(dir)).to.include('npx playwright test');
    });
  });

  describe('#buildFilterWarning', () => {
    it('explains the modified command and the @T annotation cause', () => {
      const lines = buildFilterWarning('npx playwright test --grep (Tabc123)');
      const text = lines.join('\n');
      expect(text).to.include('npx playwright test --grep (Tabc123)');
      expect(text).to.include('@T');
      expect(text).to.include('filter');
    });
  });
});
