var fs = require('fs'),
  https = require('https'),
  redis = require('redis').createClient(),
  http = require('http'),
  url = require('url')

var statics = {
  '/index.html':'text/html',
  '/cb.html':'text/html',
  '/base64.js':'application/javascript',
  '/config.js':'application/javascript',
  '/davStorage.js':'application/javascript',
  '/jquery-1.6.1.min.js':'application/javascript',
  '/sjcl.js':'application/javascript',
  '/syncStorage.js':'application/javascript',
  '/webfinger.js':'application/javascript',
  '/myfavouritesandwich.appcache':'text/cache-manifest',
  '/favicon.ico':'image/x-icon',
  '/css/uncompressed/reset.css':'text/css',
  '/css/uncompressed/text.css':'text/css',
  '/css/uncompressed/layout.css':'text/css',
  '/css/uncompressed/general.css':'text/css',
  '/css/uncompressed/img/plate.png':'image/png',
  '/css/uncompressed/img/myfavouritesandwich.png':'image/png',
  '/css/uncompressed/img/island.png':'image/png',
  '/css/uncompressed/img/footerback.png':'image/png',
  '/css/uncompressed/img/change.png':'image/png',
  '/css/uncompressed/img/changehover.png':'image/png'
}

var credentials = (function() {
  return {
    check: function(req) {
      return true
    }
  }
})()

var webdav = (function() {
  return {
    handle: function(req, res) {
      if(req.method == 'GET') {
        redis.get('storage_'+req.path, function(err, data) {
          if(data) {
            res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
            res.end(data)
          } else {
            res.writeHead(404, {'Access-Control-Allow-Origin': '*'})
            res.end()
          }
        })
      } else if(req.method == 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': req.headers.Origin,
          'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Allow-Headers': 'Authorization'
          })
        res.end()
      } else if(req.method == 'PUT') {
        if(credentials.check(req)) {
          var content = ''
          req.addListener('data', function(chunk) {
            content += chunk
          })
          req.addListener('end', function() {
            redis.set('storage_'+req.path, content, function(err, data) {
              res.writeHead(204, {
                'Access-Control-Allow-Origin': req.headers.Origin,
              })
              res.end(data)
            })
          })
        } else {
          res.writeHead(401, {
            'Access-Control-Allow-Origin': req.headers.Origin,
          })
          res.end(data)
        }
      } else if(req.method == 'DELETE') {
        if(credentials.check(req)) {
          redis.delete('storage_'+req.path, function(err, data) {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': req.headers.Origin,
            })
            res.end(data)
          })
        } else {
          res.writeHead(401, {
            'Access-Control-Allow-Origin': req.headers.Origin,
          })
          res.end(data)
        }
      }
            
    }
  }
})()

wallet = (function() {
  return {
    handle: function(req, res) {
      res.writeHead(200, {
        'Access-Control-Origin-Allow': '*'
      })
      res.end(
        JSON.stringify({
          'userAddress': 'mich@myfavouritesandwich.org',
          'dataScope': 'sandwiches',
          'storageType': 'http://unhosted.org/spec/dav/0.1',
          'davUrl': 'https://myfavouritesandwich.org/',
          'davToken': 'abcd',
          'cryptoPwd': '1234'
        })
      )
    }
  }
})()

https.createServer({
  ca:fs.readFileSync('/root/sub.class1.server.ca.pem'),
  key:fs.readFileSync('/root/sand/ssl.key'),
  cert:fs.readFileSync('/root/sand/ssl.crt')
}, function(req	, res) {
  var path = url.parse(req.url).pathname
  if(path == '/') {
    path = '/index.html'
  }
  var contentType = statics[path]
  if(contentType) {
    console.log('200: '+path)
    res.writeHead(200, {
      'Content-Type': contentType
      })
    fs.createReadStream('/root/statics'+path).pipe(res)
  } else if(path.substring(0,8) == '/webdav/') {
    webdav.handle(req, res)
  } else if(path.substring(0,8) == '/oauth2/') { 
    oauth.handle(req, res)
  } else if(path.substring(0,7) == '/wallet') { 
    wallet.handle(req, res)
  } else {
    console.log('404: '+path)
    res.writeHead(404)
    res.end()
  }
}).listen(443)

http.createServer(function(req, res) {
  res.writeHead(301, {'Location': 'https://myfavouritesandwich.org/'})
  res.end()
}).listen(80)

