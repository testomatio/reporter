const {Given, When, Then} = require("@cucumber/cucumber");

Given("I do something", function() {
  // actually nothing
});

Then("I fail", function() {
  throw new Error('fail');
})
