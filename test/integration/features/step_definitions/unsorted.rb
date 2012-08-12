
Given(/^I am on the test app$/) do
  visit('/test/integration/app')
end

Given(/^I have a user address$/) do
  @provider_host = "local.dev"
  @user_address = "me@local.dev"
end

When(/^I click "([^"]*)"$/) do |link_or_button|
  click_on link_or_button
end

When(/^I fill in "([^"]*)" as "([^"]*)"$/) do |value, field|
  fill_in field, :with => value
end

When(/^I fill in my user address$/) do
  fill_in 'remotestorage-useraddress', :with => @user_address
end

When(/^I authorize the app$/) do
  click_on "Allow"
end

When(/^debugger$/) { debugger }

Then(/^I should end up on my RemoteStorage login page$/) do
  page.current_url.should =~ /^http:\/\/#{@provider_host}\/auth\/me/
end

Then(/^I should end up on the test app$/) do
  page.current_url.should =~ /\/test\/integration\/app/
end

Then(/^the widget state should have changed to "([^"]*)"$/) do |state|
  page.evaluate_script("remoteStorage.getWidgetState()").should eq state
end

