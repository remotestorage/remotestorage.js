
require 'capybara/cucumber'

begin
  require 'ruby-debug'
rescue Exception
  ## ignored
end

Capybara.default_wait_time = 5
Capybara.default_driver = :selenium
Capybara.app_host = 'http://localhost:3000'
