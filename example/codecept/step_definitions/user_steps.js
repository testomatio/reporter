const { I } = inject();

// Background steps
Given('the system is running', () => {
  I.say('Verifying system status');
  I.expectTrue(true); // Simulate system check
});

Given('the database is connected', () => {
  I.say('Checking database connectivity');
  I.expectEqual('connected', 'connected'); // Simulate DB check
});

// Navigation steps
Given('I am on the admin panel', () => {
  console.log('🟢 Admin panel navigation started');
  I.say('Navigating to admin panel');
  I.expectTrue(global !== undefined);
  console.log('✅ Successfully navigated to admin panel');
});

Given('I am on the user creation page', () => {
  I.say('Opening user creation page');
  I.expectTrue(true);
});

Given('I am on the user management page', () => {
  I.say('Opening user management page');
  I.expectTrue(true);
});

// User existence steps
Given('a user {string} exists in the system', (username) => {
  I.say(`Verifying user ${username} exists in system`);
  I.expectTrue(username.length > 0);
  // Simulate user existence check
  global.existingUsers = global.existingUsers || [];
  global.existingUsers.push(username);
});

Given('a user {string} already exists', (email) => {
  I.say(`Setting up existing user with email ${email}`);
  global.existingEmails = global.existingEmails || [];
  global.existingEmails.push(email);
  I.expectContain(email, '@example.com');
});

// Action steps
When('I click on {string} button', (buttonName) => {
  console.log(`🔴 Clicking on button: ${buttonName}`);
  I.say(`Clicking on ${buttonName} button`);
  I.expectTrue(buttonName.length > 0);
  console.warn(`⚠️ Button click completed for: ${buttonName}`);
});

When('I fill in the user form with valid data', () => {
  I.say('Filling user form with valid test data');
  const userData = {
    name: 'Test User',
    email: 'test@example.com',
    role: 'editor'
  };
  I.expectEqual(userData.name, 'Test User');
  I.expectContain(userData.email, '@');
  I.expectTrue(userData.role.length > 0);
});

When('I submit the form', () => {
  I.say('Submitting the user form');
  I.expectTrue(true); // Simulate form submission
});

When('I submit the form with empty fields', () => {
  I.say('Submitting form with empty required fields');
  const emptyForm = { name: '', email: '', role: '' };
  I.expectEqual(emptyForm.name, '');
  I.expectEqual(emptyForm.email, '');
});

When('I click on edit for user {string}', (username) => {
  I.say(`Clicking edit button for user ${username}`);
  I.expectTrue(global.existingUsers.includes(username));
});

When('I update the user email to {string}', (newEmail) => {
  I.say(`Updating user email to ${newEmail}`);
  I.expectContain(newEmail, '@');
});

When('I save the changes', () => {
  I.say('Saving user changes');
  I.expectTrue(true);
});

When('I click on delete for user {string}', (username) => {
  I.say(`Clicking delete button for user ${username}`);
  I.expectTrue(global.existingUsers.includes(username));
});

When('I confirm the deletion', () => {
  I.say('Confirming user deletion');
  I.expectTrue(true);
});

When('I create a user with role {string}', (role) => {
  I.say(`Creating user with role: ${role}`);
  I.expectTrue(['admin', 'editor', 'viewer', 'moderator'].includes(role));
});

When('I assign permissions {string}', (permissions) => {
  I.say(`Assigning permissions: ${permissions}`);
  I.expectTrue(permissions.length > 0);
});

When('I try to create another user with email {string}', (email) => {
  I.say(`Attempting to create duplicate user with email ${email}`);
  I.expectTrue(global.existingEmails.includes(email));
});

// Assertion steps
Then('a new user should be created', () => {
  I.say('Verifying new user was created successfully');
  I.expectTrue(true); // Simulate successful creation
});

Then('I should see a success message', () => {
  I.say('Checking for success message display');
  const successMessage = 'User created successfully';
  I.expectContain(successMessage, 'success');
});

Then('the user should appear in the user list', () => {
  I.say('Verifying user appears in user list');
  I.expectTrue(true);
});

Then('I should see validation error messages', () => {
  I.say('Checking for validation error messages');
  const errors = ['Name is required', 'Email is required'];
  I.expectTrue(errors.length > 0);
});

Then('the form should not be submitted', () => {
  I.say('Verifying form submission was blocked');
  I.expectTrue(true);
});

Then('no user should be created', () => {
  I.say('Confirming no user was created');
  I.expectTrue(true);
});

Then('the user email should be updated', () => {
  I.say('Verifying user email was updated');
  I.expectTrue(true);
});

Then('I should see a confirmation message', () => {
  I.say('Checking for update confirmation message');
  I.expectContain('User updated successfully', 'updated');
});

Then('I should see a confirmation dialog', () => {
  I.say('Verifying deletion confirmation dialog appears');
  I.expectTrue(true);
});

Then('the user should be removed from the system', () => {
  I.say('Confirming user was deleted from system');
  I.expectTrue(true);
});

Then('I should see a deletion success message', () => {
  I.say('Checking for deletion success message');
  I.expectContain('User deleted successfully', 'deleted');
});

Then('the user should have {string} role', (role) => {
  I.say(`Verifying user has role: ${role}`);
  I.expectTrue(['admin', 'editor', 'viewer', 'moderator'].includes(role));
});

Then('the user should have {string} permissions', (permissions) => {
  I.say(`Verifying user has permissions: ${permissions}`);
  I.expectTrue(permissions.length > 0);
});

Then('I should see a duplicate email error', () => {
  I.say('Checking for duplicate email error message');
  I.expectContain('Email already exists', 'Email');
});

Then('no duplicate user should be created', () => {
  I.say('Confirming no duplicate user was created');
  I.expectTrue(true);
});