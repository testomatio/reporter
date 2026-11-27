/* eslint-disable no-undef */
Feature('Suite 1 @S25e19ba9');

Scenario('Test issue for suite 1 @Tca70c8c4', ({ I }) => {
  I.amOnPage('https://github.com/login');
  I.see('GitHub');
  I.fillField('login', 'randomuser_kmk');
  I.fillField('password', 'randomuser_kmk');
  I.click('Sign in');
  I.see('Repositories');
});
