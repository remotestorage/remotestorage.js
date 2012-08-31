
Feature: Connect through Widget

  Background:
    Given my localStorage is empty
    And I am on the test app

  Scenario: Connect with my RemoteStorage account
    Given I have a user address
    And I am on the test app
    When I click "connect"
    And I fill in my user address
    And I click "connect"
    # This one needs to be defined per-provider(-software):
    Then I should end up on my RemoteStorage login page
    When I authorize the app
    Then I should end up on the test app
    And the widget state should have changed to "connected"
