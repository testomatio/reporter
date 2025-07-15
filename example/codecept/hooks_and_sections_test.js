const { Section } = require('codeceptjs/steps');

Feature('Hooks and Sections Combined Test @hooks-and-sections');

BeforeSuite(({ I }) => {
  console.log('BeforeSuite: Global setup');
  I.expectEqual('global', 'global');
});

Before(({ I }) => {
  console.log('Before: Test setup');
  I.expectTrue(true);
});

After(({ I }) => {
  console.log('After: Test cleanup');
  I.expectFalse(false);
});

AfterSuite(({ I }) => {
  console.log('AfterSuite: Global cleanup');
  I.expectEqual('end', 'end');
});

Scenario('Test with both hooks and sections', ({ I }) => {
  console.log('Main test execution with sections');
  
  // Initial setup steps
  I.expectEqual(1, 1);
  
  // Start first section
  Section('Data Preparation');
  I.expectEqual('data', 'data');
  I.expectTrue(!!global);
  Section();
  
  // Second section
  Section('Processing');
  I.expectEqual(2 + 2, 4);
  I.expectContain('processing test', 'test');
  Section();
  
  // Final steps
  I.expectTrue(true);
});