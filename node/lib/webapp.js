(function() {
  var url = require('url')
    , fs = require('fs')

  var config = require('../config.js')

  var files =  { '/index.html': 'text/html'
    , '/preview.html': 'text/html'
    , '/cb.html': 'text/html'
    , '/base64.js': 'application/javascript'
    , '/config.js': 'application/javascript'
    , '/davStorage.js': 'application/javascript'
    , '/jquery-1.6.1.min.js': 'application/javascript'
    , '/sjcl.js': 'application/javascript'
    , '/syncStorage.js': 'application/javascript'
    , '/webfinger.js': 'application/javascript'
    , '/socket.io.js': 'application/javascript'
    , '/favicon.ico': 'image/x-icon'
    , '/css/uncompressed/reset.css': 'text/css'
    , '/css/uncompressed/text.css': 'text/css'
    , '/css/uncompressed/layout.css': 'text/css'
    , '/css/uncompressed/general.css': 'text/css'
    , '/css/uncompressed/img/plate.png': 'image/png'
    , '/css/uncompressed/img/myfavouritesandwich.png': 'image/png'
    , '/css/uncompressed/img/island.png': 'image/png'
    , '/css/uncompressed/img/footerback.png': 'image/png'
    , '/css/uncompressed/img/change.png': 'image/png'
    , '/css/uncompressed/img/changehover.png': 'image/png'
  }

  function serveAppCache(req, res) {
    res.writeHead(200, {'Content-Type': 'text/cache-manifest'})
    res.write('CACHE MANIFEST\n\n#version: '+ config.appCacheTimestamp +'\nNETWORK:\n\n*\nCACHE:\n')
    for(var i in files) {
       res.write(i.substr(1) +'\n')
    }
    res.end()
  }

  function handle(req, res) {
    var path = url.parse(req.url).pathname
    if(path == '/') {
      path = '/index.html'
    }
    var contentType = files[path]
    if(contentType) {
      console.log('200: '+path)
      res.writeHead( 200
                   , { 'Access-Control-Origin-Allow': '*'
                     , 'Content-Type': contentType
                     }
                   )
      fs.createReadStream(config.staticsPath+path).pipe(res)
    } else if(path == '/.appcache') {
      serveAppCache(req, res)
    } else {
      console.log('404: '+path)
      res.writeHead(404)
      res.end()
    }
  }

  module.exports.handle = handle
})()
