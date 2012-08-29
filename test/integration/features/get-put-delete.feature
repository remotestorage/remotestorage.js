
Feature: GET / PUT / DELETE

  Background:
    Given my localStorage is empty
    And I am on the test app

  Scenario: Listing the empty root
    When I get the listing of "/"
    Then I should receive '[]'

  Scenario: Getting a non-existant key
    When I get the key "/foo"
    Then I should receive ''

  Scenario: Setting a key, then getting it
    When I set the key "/foo" of type "dummy" to "bar"
    And I get the key "/foo"
    Then I should receive '"bar"'

