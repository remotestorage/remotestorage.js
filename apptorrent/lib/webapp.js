(function() {
  var url = require('url')
    , fs = require('fs')

  var config = require('../config.js')

  var apps = {}

  function addApp(hostName, files) {
    apps[hostName] = files
  }

  function serveAppCache(req, res, hostname) {
    res.writeHead(200, {'Content-Type': 'text/cache-manifest'})
    res.write('CACHE MANIFEST\n\n#version: '+ config.appCacheTimestamp +'\nNETWORK:\n\n*\nCACHE:\n')
    var urlObj = url.parse(req.url)
    if(apps[hostname]){
      for(var i in apps[hostname]) {
        res.write(i.substr(1) +'\n')
      }
    }
    res.end()
  }

  function handle(req, res, hostname) {
    var urlObj = url.parse(req.url)

    var contentType
    if(urlObj.pathname == '/') {
      urlObj.pathname = '/index.html'
    }
    if(apps[hostname]) {
      contentType = apps[hostname][urlObj.pathname]
       console.log('host: '+hostname)
    } else {
       console.log('unknown host '+JSON.stringify(req))
    }
    if(contentType) {
      console.log('200: '+urlObj.pathname)
      res.writeHead( 200
                   , { 'Access-Control-Allow-Origin': '*'
                     , 'Content-Type': contentType
                     }
                   )
      fs.createReadStream(config.appsPath+hostname+urlObj.pathname).pipe(res)
    } else if((urlObj.pathname == '/.appcache') && (config.useAppCache)) {
      serveAppCache(req, res, hostname)
    } else {
      console.log('404: '+urlObj.pathname)
      res.writeHead(404)
      res.end()
    }
  }

  module.exports.addApp = addApp
  module.exports.handle = handle
})()
