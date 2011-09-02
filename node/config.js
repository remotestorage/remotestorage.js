(function() {
  module.exports.sslDir = '/root/ssl-cert/'
  module.exports.staticsPath = '/root/unhosted/node/statics/'
  module.exports.appUrl = 'https://myfavouritesandwich.org/'
  module.exports.appCacheTimestamp = new Date().getTime()//whenever the server restarts, browsers will be told to flush their appcache. good for development mode.
  module.exports.browserIdVerifier = {host: 'browserid.org'
                                    , port: 443
                                    , path: '/verify'
                                    , method: 'POST'}
  module.exports.browserIdAudience = 'myfavouritesandwich.org'
  module.exports.ownCloudLink = {host: 'localhost'
                                    , port: 444
                                    , path: '/apps/unhosted_web/ajax/link.php'
                                    , method: 'POST'
                                    , secret: 'XRlc2FuZHdpY2gub3JnIiwiZW1haWwiOiJhc2RmYXNkZkB1b'
                                    }
})()
