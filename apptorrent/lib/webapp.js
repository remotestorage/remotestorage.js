(function() {
  var url = require('url')
    , fs = require('fs')

  var config = require('../config.js')

  var apps = {}

  function addApp(hostName, files) {
    apps[hostName] = files
  }

  function serveAppCache(req, res) {
    res.writeHead(200, {'Content-Type': 'text/cache-manifest'})
    res.write('CACHE MANIFEST\n\n#version: '+ config.appCacheTimestamp +'\nNETWORK:\n\n*\nCACHE:\n')
    var urlObj = url.parse(req.url)
    if(apps[urlObj.hostname]){
      for(var i in apps[urlObj.hostname]) {
        res.write(i.substr(1) +'\n')
      }
    }
    res.end()
  }

  function handle(req, res) {
    var urlObj = url.parse(req.url)

    urlObj.hostname = 'myfavouritesandwich.org'

    var contentType
    if(urlObj.pathname == '/') {
      urlObj.pathname = '/index.html'
    }
    if(apps[urlObj.hostname]) {
      contentType = apps[urlObj.hostname][urlObj.pathname]
       console.log('host: '+urlObj.hostname)
    } else {
       console.log('unknown host '+JSON.stringify(req))
    }
    if(contentType) {
      console.log('200: '+urlObj.pathname)
      res.writeHead( 200
                   , { 'Access-Control-Origin-Allow': '*'
                     , 'Content-Type': contentType
                     }
                   )
      fs.createReadStream(config.appsPath+urlObj.hostname+urlObj.pathname).pipe(res)
    } else if(urlObj.pathname == '/.appcache') {
      serveAppCache(req, res)
    } else {
      console.log('404: '+urlObj.pathname)
      res.writeHead(404)
      res.end()
    }
  }

  module.exports.addApp = addApp
  module.exports.handle = handle
})()
