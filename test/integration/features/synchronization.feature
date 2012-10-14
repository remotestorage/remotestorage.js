
Feature: Synchronization

  Background:
    Given my localStorage is empty
    And my remotestorage is empty
    And I am on the test app

  Scenario: Storing data first, then connecting, disconnecting, connecting and retrieving it again
    When I set the key "/foo" of type "dummy" to '{"bar":"baz"}'
    And I connect to remotestorage
    And I disconnect from remotestorage
    When I get the key "/foo"
    And I wait a second
    Then I should receive ''
    When I connect to remotestorage
    And I wait a second
    And I get the key "/foo"
    Then I should receive '{"bar":"baz","@type":"https://remotestoragejs.com/spec/modules/root/dummy"}'

  Scenario: Connecting, then storing data
    When I connect to remotestorage
    And I set the key "/baz" of type "xyz" to '{"foo":"bar"}'
    And I get the key "/baz"
    Then I should receive '{"foo":"bar","@type":"https://remotestoragejs.com/spec/modules/root/xyz"}'
    
    When I disconnect from remotestorage
    And I clear my localStorage

    And I am on the test app
    And I connect to remotestorage
    And I wait a second
    And I get the key "/baz"
    Then I should receive '{"foo":"bar","@type":"https://remotestoragejs.com/spec/modules/root/xyz"}'

