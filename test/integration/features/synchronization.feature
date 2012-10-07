
Feature: Synchronization

  Background:
    Given my localStorage is empty
    And I am on the test app

  Scenario: Storing data first, then connecting, disconnecting, connecting and retrieving it again
    When I set the key "/foo" of type "dummy" to '{"bar":"baz"}'
    And I connect to remotestorage
    And I disconnect from remotestorage
    And I wait a second
    When I get the key "/foo"
    Then I should receive ''
    When I connect to remotestorage
    And I wait a second
    And I get the key "/foo"
    Then I should receive '{"bar":"baz"}'

