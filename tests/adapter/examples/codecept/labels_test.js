/* eslint-disable no-undef */
const testomat = require('../../../../lib/reporter.js');

Feature('Label Function Tests @S12345680');

Scenario('Test with single label without value @T12345010', () => {
  // Add single label without value
  testomat.label('smoke');
  
  const result = 1 + 1;
  console.log('Test executed with single label');
});

Scenario('Test with single label with value @T12345011', () => {
  // Add single label with value
  testomat.label('severity', 'high');
  
  const result = 2 * 2;
  console.log('Test executed with single label and value');
});

Scenario('Test with multiple label calls @T12345012', () => {
  // Add multiple labels using separate calls
  testomat.label('smoke');
  testomat.label('priority', 'critical');
  testomat.label('team', 'qa');
  
  const result = 3 + 3;
  console.log('Test executed with multiple label calls');
});

Scenario('Test with mixed label types @T12345013', () => {
  // Mix of labels with and without values
  testomat.label('regression');
  testomat.label('severity', 'medium');
  testomat.label('feature', 'user_account');
  testomat.label('environment', 'staging');
  
  const result = 4 + 4;
  console.log('Test executed with mixed label types');
});

Scenario('Test with simple labels @T12345014', () => {
  // Multiple simple labels without values
  testomat.label('integration');
  testomat.label('functional');
  testomat.label('ui');
  
  const result = 5 + 5;
  console.log('Test executed with simple labels');
});

Scenario('Test without labels @T12345015', () => {
  // This test has no labels for comparison
  const result = 6 + 6;
  console.log('Test executed without labels');
});