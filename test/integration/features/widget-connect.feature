
Feature: Connect through Widget

  Scenario: Connect with my RemoteStorage account
    Given I am on the test app
    When I click "connect"
    And I fill in "integration-test@heahdk.net" as "remotestorage-useraddress"
    # This one needs to be defined per-provider(-software):
    Then I should end up on my RemoteStorage login page
    Then I should end up on the test app
    And the widget state should have changed to "connected"
