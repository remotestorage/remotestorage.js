
Feature: GET / PUT / DELETE

  Background:
    Given my localStorage is empty
    And my remotestorage is empty
    And I am on the test app

  Scenario: Listing the empty root
    When I get the listing of "/"
    Then I should receive '[]'

  Scenario: Getting a non-existant key
    When I get the key "/foo"
    Then I should receive ''

  Scenario: Setting a key, then getting it
    When I set the key "/foo" of type "dummy" to '{"bar":"baz"}'
    And I get the key "/foo"
    Then I should receive '{"bar":"baz","@type":"https://remotestoragejs.com/spec/modules/root/dummy"}'


  Scenario: Setting a key, then removing it
    When I set the key "/foo" of type "dummy" to '{"bar":"baz"}'
    And I get the key "/foo"
    Then I should receive '{"bar":"baz","@type":"https://remotestoragejs.com/spec/modules/root/dummy"}'
    When I remove the key "/foo"
    And I get the key "/foo"
    Then I should receive ''

  Scenario: Setting a key, then listing contents
    When I set the key "/foo" of type "dummy" to '{"bar":"baz"}'
    And I get the key "/foo"
    Then I should receive '{"bar":"baz","@type":"https://remotestoragejs.com/spec/modules/root/dummy"}'
    When I get the listing of "/"
    Then I should receive '["foo"]'

