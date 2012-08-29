
require 'capybara/cucumber'
require 'ruby-debug'

Capybara.default_driver = :selenium
Capybara.app_host = 'http://localhost:3000'
