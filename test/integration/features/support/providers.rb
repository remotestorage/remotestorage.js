
PROVIDERS = {
  :remote_storage_ruby => {
    :in => 'providers/remote-storage-ruby/',
    :run => 'rackup -p {port} -l {hostname}',
    :with_domain => 'remote-storage-ruby.dev'
  }
}

# don't call this from any test. instead use start-provider script.
def start_provider(type)

  raise "Unknown provider: #{type}" unless provider = PROVIDERS[type]

  Dir.chdir(provider[:in]) && system(
    provider[:run].sub('{port}', '80').sub('{domain}') { provider[:with_domain] }
  )

end
