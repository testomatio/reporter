const { Section } = require('codeceptjs/steps');

Feature('Steps and Sections Demo @steps-sections');

Scenario('Test with multiple sections and steps', ({ I }) => {
  console.log('Starting comprehensive steps test');
  
  I.say('Starting test execution with comment steps');
  
  // Initial setup steps
  I.expectEqual(1, 1);
  I.expectTrue(true);
  
  // Start first section
  Section('User Authentication');
  I.say('Validating user authentication process');
  I.expectEqual('user', 'user');
  I.expectTrue(!!global);
  I.expectContain('authentication process', 'authentication');
  
  // Nested operations within authentication
  I.expectNotEqual('admin', 'user');
  I.expectFalse(false);
  Section(); // Close current section
  
  // Start second section  
  Section('Data Processing');
  I.say('Processing test data with various validations');
  const data = { id: 1, name: 'test', active: true };
  I.expectEqual(data.id, 1);
  I.expectEqual(data.name, 'test');
  I.expectTrue(data.active);
  
  // Simulate data validation steps
  I.expectContain(data.name, 'test');
  I.expectNotContain(data.name, 'invalid');
  
  // Start third section (auto-closes previous)
  Section('Result Verification');
  I.say('Verifying final results and calculations');
  const result = data.id * 2;
  I.expectEqual(result, 2);
  I.expectTrue(result > 0);
  I.expectFalse(result < 0);
  
  // Final validation
  I.expectEqual(typeof result, 'number');
  Section(); // Close final section
  
  // Cleanup steps outside sections
  I.say('Performing final cleanup and validation');
  I.expectTrue(true);
  console.log('Test completed successfully');
});

Scenario('Test with failing step in section', ({ I }) => {
  console.log('Starting test with intentional failure');
  
  I.say('Testing error handling within sections');
  
  Section('Successful Operations');
  I.say('These operations should succeed');
  I.expectEqual(1, 1);
  I.expectTrue(true);
  Section();
  
  Section('Operations with Failure');
  I.say('This section contains intentional failure');
  I.expectEqual(2, 2);
  I.expectEqual(3, 5); // This should fail intentionally
  I.expectTrue(false); // This won't execute due to previous failure
  Section();
});

Scenario('Test with complex data operations', ({ I }) => {
  console.log('Starting complex data operations test');
  
  I.say('Testing comprehensive data structure operations');
  
  Section('Array Operations');
  I.say('Performing various array validations');
  const arr = [1, 2, 3, 4, 5];
  I.expectEqual(arr.length, 5);
  I.expectTrue(arr.includes(3));
  I.expectFalse(arr.includes(10));
  I.expectEqual(arr[0], 1);
  I.expectEqual(arr[arr.length - 1], 5);
  Section();
  
  Section('Object Operations');
  I.say('Validating object properties and structure');
  const obj = { 
    name: 'test object', 
    count: 42, 
    active: true,
    items: ['a', 'b', 'c']
  };
  I.expectEqual(obj.name, 'test object');
  I.expectEqual(obj.count, 42);
  I.expectTrue(obj.active);
  I.expectEqual(obj.items.length, 3);
  I.expectContain(obj.name, 'test');
  Section();
  
  Section('Mathematical Operations');
  I.say('Checking mathematical calculations and comparisons');
  const x = 10;
  const y = 5;
  I.expectEqual(x + y, 15);
  I.expectEqual(x - y, 5);
  I.expectEqual(x * y, 50);
  I.expectEqual(x / y, 2);
  I.expectTrue(x > y);
  I.expectFalse(x < y);
  Section();
  
  console.log('Complex data operations completed');
});