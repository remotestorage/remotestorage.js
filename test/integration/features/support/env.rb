
require 'capybara/cucumber'

require 'ruby-debug' rescue nil

Capybara.default_wait_time = 5
Capybara.default_driver = :selenium
Capybara.app_host = 'http://localhost:3000'
