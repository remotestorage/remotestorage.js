
PROVIDERS = {
  :remote_storage_ruby => {
    :in => 'providers/remote-storage-ruby/',
    :run => 'rackup -p {port}',
    :on_port => 23457
  }
}

# don't call this from any test. instead use start-provider script.
def start_provider(type)

  raise "Unknown provider: #{type}" unless provider = PROVIDERS[type]

  Dir.chdir(provider[:in]) && system(
    provider[:run].sub('{port}') { provider[:on_port] }
  )

end
