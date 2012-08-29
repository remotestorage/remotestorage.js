
Given(/^my localStorage is empty$/) do
  step("I am on the test app")
  page.evaluate_script('localStorage.clear();')
end

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
  sleep(0.2) # (sometimes this takes a while)
  page.current_url.should =~ /^http:\/\/#{@provider_host}\/auth\/me/
end

Then(/^I should end up on the test app$/) do
  page.current_url.should =~ /\/test\/integration\/app/
end

Then(/^the widget state should have changed to "([^"]*)"$/) do |state|
  page.evaluate_script("remoteStorage.getWidgetState()").should eq state
end

When(/^I get the listing of "([^"]*)"$/) do |path|
  @response = page.evaluate_script("remoteStorage.root.getListing('#{path}')")
end

When(/^I get the key "([^"]+)"$/) do |path|
  @response = page.evaluate_script("remoteStorage.root.getObject('#{path}')")
end

When(/^I set the key "([^"]+)" of type "([^"]+)" to "([^"]+)"$/) do |key, type, value|
  @response = page.evaluate_script("remoteStorage.root.setObject('#{type}', '#{key}', '#{value}')")
end

Then(/^I should receive '([^']*)'$/) do |json|
  json.length > 0 ? (@response.to_json.should eq json) : ("#{@response}".should eq json)
end
