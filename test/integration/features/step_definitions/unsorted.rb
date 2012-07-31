
Given(/^I am on the test app$/) do
  visit('/test/integration/app')
end

Given(/^I have worked around Michiel's confusion protection mechanism$/) do
  page.execute_script('localStorage.michiel = true');
  step "I am on the test app" # (need to reload page to make it work)
end

When(/^I click "([^"]*)"$/) do |link_or_button|
  click_on link_or_button
end

When(/^I fill in "([^"]*)" as "([^"]*)"$/) do |value, field|
  fill_in field, :with => value
end

Then(/^I should end up on my RemoteStorage login page$/) do
  page.url.should eq 'http://test.heahdk.net/_auth'
end

When(/^I authorize with my RemoteStorage provider$/) do
  step %{I fill in "integration" as "name"}
  step %{I fill in "integration" as "password"}
  click_on "Authenticate"
end

Then(/^I should end up on the test app$/) do
  pending # express the regexp above with the code you wish you had
end

Then(/^the widget state should have changed to "([^"]*)"$/) do |arg1|
  pending # express the regexp above with the code you wish you had
end

