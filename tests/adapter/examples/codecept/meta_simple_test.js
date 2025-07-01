/* eslint-disable no-undef */
const testomat = require('../../../../lib/reporter.js');

Feature('Meta Function Tests (Simple) @S12345679');

Scenario('Test with single meta data @T12345006', () => {
  // Add meta data to the test
  testomat.meta({ browser: 'chrome', version: '91.0' });
  
  // Simple assertion without browser
  const result = 1 + 1;
  console.log('Test executed with meta data');
});

Scenario('Test with multiple meta calls @T12345007', () => {
  // Add multiple meta data calls
  testomat.meta({ browser: 'firefox' });
  testomat.meta({ os: 'windows', version: '10' });
  testomat.meta({ testType: 'regression' });
  
  // Simple assertion
  const result = 2 * 2;
  console.log('Test executed with multiple meta calls');
});

Scenario('Test with string key-value meta @T12345008', () => {
  // Add meta data using string key-value format
  testomat.meta('environment', 'staging');
  testomat.meta('priority', 'high');
  
  // Simple assertion
  const result = 3 + 3;
  console.log('Test executed with string key-value meta');
});

Scenario('Test without meta data @T12345009', () => {
  // This test has no meta data for comparison
  const result = 4 + 4;
  console.log('Test executed without meta data');
});