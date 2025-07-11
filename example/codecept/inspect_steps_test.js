const { Section } = require('codeceptjs/steps');

Feature('Step Inspection @step-inspection');

Scenario('Inspect test steps structure', ({ I }) => {
  console.log('=== STEP INSPECTION TEST ===');
  
  // Simple steps
  I.expectEqual(1, 1);
  I.expectTrue(true);
  
  // Section with nested steps
  Section('Authentication Section');
  I.expectEqual('user', 'user');
  I.expectContain('hello world', 'world');
  Section();
  
  // Another section
  Section('Validation Section');
  I.expectNotEqual(1, 2);
  I.expectFalse(false);
  Section();
  
  console.log('=== END STEP INSPECTION ===');
});