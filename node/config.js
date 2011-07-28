(function() {
  module.exports.sslDir = '/root/mfs/ssl-cert/'
  module.exports.staticsPath = '/root/mfs/statics/'
  module.exports.appUrl = 'https://myfavouritesandwich.org/'
  module.exports.appCacheTimestamp = new Date().getTime()//whenever the server restarts, browsers will be told to flush their appcache. good for development mode.
})()
