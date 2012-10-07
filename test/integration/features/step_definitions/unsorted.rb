
def eval_js(code)
  js = "(function() { try { return #{code}; } catch(exc) { return 'CUKE-ERR:' + exc; } })()"

  response = page.evaluate_script(js)

  if response =~ /^CUKE-ERR\:(.+)$/
    raise "JS error: #{$~[1]}"
  end

  return response
end

Given(/^(?:my localStorage is empty|I clear my localStorage)$/) do
  step("I am on the test app")
  page.evaluate_script('localStorage.clear();')
end


Given(/^(?:my remotestorage is empty|I clear my remotestorage)$/) do
  Net::HTTP.start('local.dev') {|http| http.post('/reset', '') }
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
  eval_js("stateChanges").should include state
  page.execute_script("clearStateChanges()")
end

When(/^I get the listing of "([^"]*)"$/) do |path|
  @response = eval_js("remoteStorage.root.getListing('#{path}')")
end

When(/^I get the key "([^"]+)"$/) do |path|
  @response = eval_js("remoteStorage.root.getObject('#{path}')")
end

When(/^I set the key "([^"]+)" of type "([^"]+)" to '([^']+)'$/) do |key, type, value|
  eval_js("remoteStorage.root.setObject('#{type}', '#{key}', #{value})")
end

When(/^I remove the key "([^"]+)"$/) do |key|
  eval_js("remoteStorage.root.removeObject('#{key}')")
end

Then(/^I should receive '([^']*)'$/) do |json|
  json.length > 0 ? (@response.to_json.should eq json) : ("#{@response}".should eq json)
end

When(/^I connect to remotestorage$/) do
  step "I have a user address"
  step "I am on the test app"
  step 'I click "connect"'
  step 'I fill in my user address'
  step 'I click "connect"'
  step "I should end up on my RemoteStorage login page"
  step "I authorize the app"
  step "I should end up on the test app"
  step 'the widget state should have changed to "connected"'
end

When(/^I disconnect from remotestorage$/) do
  page.find(:css, '#remotestorage-cube').click
end

When(/^I wait a second$/) do
  sleep(1)
end
