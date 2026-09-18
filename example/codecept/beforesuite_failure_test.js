const assert = require('assert');

Feature('Teams @beforesuite-failure');

BeforeSuite(async ({ I }) => {
  assert.fail('Fails in before suite');
});

Scenario('test teams can be created', ({ I }) => {
  I.amOnPage('/teams');
  I.say('Creating team');
});

Scenario('test teams can be updated', ({ I }) => {
  I.amOnPage('/teams');
  I.say('Updating team');
});

Scenario('test teams can be deleted', ({ I }) => {
  I.amOnPage('/teams');
  I.say('Deleting team');
});
