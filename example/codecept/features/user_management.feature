@bdd-feature
Feature: User Management System
  As a system administrator
  I want to manage user accounts
  So that I can control access to the application

  Background:
    Given the system is running
    And the database is connected

  @smoke @user-creation
  Scenario: Create a new user account
    Given I am on the admin panel
    When I click on "Create User" button
    And I fill in the user form with valid data
    And I submit the form
    Then a new user should be created
    And I should see a success message
    And the user should appear in the user list

  @regression @user-validation
  Scenario: Validate user input during creation
    Given I am on the user creation page
    When I submit the form with empty fields
    Then I should see validation error messages
    And the form should not be submitted
    And no user should be created

  @user-operations
  Scenario: Update existing user information
    Given a user "john.doe" exists in the system
    And I am on the user management page
    When I click on edit for user "john.doe"
    And I update the user email to "john.new@example.com"
    And I save the changes
    Then the user email should be updated
    And I should see a confirmation message

  @user-operations @security
  Scenario: Delete user account with confirmation
    Given a user "temp.user" exists in the system
    And I am on the user management page
    When I click on delete for user "temp.user"
    Then I should see a confirmation dialog
    When I confirm the deletion
    Then the user should be removed from the system
    And I should see a deletion success message

  @data-driven @user-creation
  Scenario Outline: Create users with different roles
    Given I am on the user creation page
    When I create a user with role "<role>"
    And I assign permissions "<permissions>"
    Then the user should have "<role>" role
    And the user should have "<permissions>" permissions

    Examples:
      | role      | permissions           |
      | admin     | full_access          |
      | editor    | read_write           |
      | viewer    | read_only            |
      | moderator | read_write_moderate  |

  @error-handling
  Scenario: Handle duplicate user creation
    Given a user "existing.user@example.com" already exists
    When I try to create another user with email "existing.user@example.com"
    Then I should see a duplicate email error
    And the form should not be submitted
    And no duplicate user should be created