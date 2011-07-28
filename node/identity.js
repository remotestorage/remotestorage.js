(function() {
  var fs = require('fs')
    , url = require('url')

  var files = {'/.well-known/host-meta': 'application/xml+xrd'
    , '/webfinger': 'application/xml+xrd'
  }

  function serveAppCache(req, res) {
    res.writeHead(200, {'Content-Type': 'text/cache-manifest'})
    res.write('CACHE MANIFEST\n\n#version: '+ appCacheTime +'\nNETWORK:\n\n*\nCACHE:\n')
    for(var i in statics) {
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
