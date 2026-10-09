import { Given, When, Then } from '@cucumber/cucumber';

Given('I do something', function () {
  // actually nothing
});

Then('I fail', function () {
  throw new Error('fail');
});
