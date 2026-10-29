/**
 * Example WebdriverIO test file demonstrating beforeEach hook failure
 *
 * This file demonstrates how the WebdriverIO Hooks Enhancer handles
 * beforeEach hook failures.
 *
 * Run with: TESTOMATIO_DEBUG=1 npx wdio run wdio.conf.js
 */

describe('User Authentication', () => {
  beforeEach(async () => {
    // This could be a database connection failure, login failure, etc.
    throw new Error('Failed to initialize authentication service');
  });

  it('should login with valid credentials', async () => {
    // This test will never run due to beforeEach failure
    await browser.url('/login');
    await $('#username').setValue('testuser');
    await $('#password').setValue('password123');
    await $('#login-button').click();

    await expect($('#welcome-message')).toBeDisplayed();
  });

  it('should display error for invalid credentials', async () => {
    // This test will never run due to beforeEach failure
    await browser.url('/login');
    await $('#username').setValue('invalid');
    await $('#password').setValue('wrong');
    await $('#login-button').click();

    await expect($('#error-message')).toBeDisplayed();
  });

  it('should remember user session', async () => {
    // This test will never run due to beforeEach failure
    await browser.url('/login');
    await $('#username').setValue('testuser');
    await $('#password').setValue('password123');
    await $('#remember-me').click();
    await $('#login-button').click();

    await browser.reload();
    await expect($('#welcome-message')).toBeDisplayed();
  });

  it('should logout successfully', async () => {
    // This test will never run due to beforeEach failure
    await browser.url('/login');
    await $('#username').setValue('testuser');
    await $('#password').setValue('password123');
    await $('#login-button').click();

    await $('#logout-button').click();
    await expect($('#login-form')).toBeDisplayed();
  });
});
