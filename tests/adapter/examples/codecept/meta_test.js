/* eslint-disable no-undef */
const testomat = require('../../../../lib/reporter.js');

Feature('Meta Function Tests @S12345678');

Scenario('Test with single meta data @T12345001', ({ I }) => {
  // Add meta data to the test
  testomat.meta({ browser: 'chrome', version: '91.0' });
  
  I.amOnPage('https://github.com/login');
  I.see('GitHub');
});

Scenario('Test with multiple meta calls @T12345002', ({ I }) => {
  // Add multiple meta data calls
  testomat.meta({ browser: 'firefox' });
  testomat.meta({ os: 'windows', version: '10' });
  testomat.meta({ testType: 'regression' });
  
  I.amOnPage('https://github.com/login');
  I.see('GitHub');
});

Scenario('Test with string key-value meta @T12345003', ({ I }) => {
  // Add meta data using string key-value format
  testomat.meta('environment', 'staging');
  testomat.meta('priority', 'high');
  
  I.amOnPage('https://github.com/login');
  I.see('GitHub');
});

Scenario('Test with complex meta object @T12345004', ({ I }) => {
  // Add complex meta data
  testomat.meta({
    execution: {
      browser: 'safari',
      version: '14.1',
      platform: 'macOS'
    },
    test: {
      category: 'smoke',
      tags: ['login', 'authentication'],
      priority: 'critical'
    }
  });
  
  I.amOnPage('https://github.com/login');
  I.see('GitHub');
});

Scenario('Test without meta data @T12345005', ({ I }) => {
  // This test has no meta data for comparison
  I.amOnPage('https://github.com/login');
  I.see('GitHub');
});