
Feature: GET / PUT / DELETE

  Background:
    Given my localStorage is empty

  Scenario: Listing the empty root
    Given I am on the test app
    When I get the listing of "/"
    Then I should receive '[]'
