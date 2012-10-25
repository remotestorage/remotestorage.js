
require 'capybara/cucumber'

begin
  require 'ruby-debug'
rescue Exception
  ## ignored
end

require 'selenium/webdriver'

caps = Selenium::WebDriver::Remote::Capabilities.firefox
caps.version = "8"

Capybara.default_wait_time = 5
Capybara.default_driver = :selenium
Capybara.register_driver :selenium do |app|
  Capybara::Selenium::Driver.new(app,
    :browser => :remote,
    :url => "http://localhost:4444/wd/hub",
    :desired_capabilities => caps)
end
Capybara.app_host = 'http://localhost:3000'
