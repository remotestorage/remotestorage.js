
Given(/^I am on the test app$/) do
  visit('/test/integration/app')
end

Given(/^I have a user address$/) do
  # TODO: make most of this configurable.
  @provider = :remote_storage_ruby
  @provider_host = "localhost:#{PROVIDERS[@provider][:on_port]}"
  @login = "integration"
  @password = "integration"
  @user_address = "login@#{@provider_host}"
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

When(/^I fill in my user address$/) do
  fill_in 'remotestorage-useraddress', :with => @user_address
end

When(/^debugger$/) { debugger }

Then(/^I should end up on my RemoteStorage login page$/) do
  debugger
  page.current_url.should eq "http://#{@provider_host}/_auth"
end

When(/^I authenticate with my RemoteStorage provider$/) do
  step %{I fill in @login as "name"}
  step %{I fill in @password as "password"}
  click_on "Authenticate"
end

Then(/^I should end up on the test app$/) do
  pending # express the regexp above with the code you wish you had
end

Then(/^the widget state should have changed to "([^"]*)"$/) do |arg1|
  pending # express the regexp above with the code you wish you had
end

