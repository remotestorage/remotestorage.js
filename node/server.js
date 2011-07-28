var webapp = require('./webapp.js')
  , wallet = require('./wallet.js')
  , identity = require('./identity.js')
  , storage = require('./storage.js')
  , config = require('./config.js')
  , https = require('https')
  , http = require('http')
  , fs = require('fs')

https.createServer({ ca:fs.readFileSync(config.sslDir +'sub.class1.server.ca.pem')
                   , key:fs.readFileSync(config.sslDir +'ssl.key')
                   , cert:fs.readFileSync(config.sslDir +'ssl.crt')
                   }
                 , function(req, res) {
  var path = url.parse(req.url).pathname
  if(path.substring(0,12) == '/oauth2/auth') {
    storage.handleOAuth(req, res)
  } else if(path.substring(0,8) == '/webdav') {
    storage.handleWebdav(req, res)
  } else if(path.substring(0,7) == '/wallet') {
    wallet.handle(req, res)
  } else if(path.substring(0,22) == '/.well-known/host-meta') {
    //identity.handleHostmeta(req, res)
    identity.handle(req, res)
  } else if (path.substring(0,10) == '/webfinger') {
    //identity.handleWebfinger(req, res)
    identity.handle(req, res)
  } else {
    webapp.handle(req, res)
  }
}).listen(443)

http.createServer(function(req, res) {
  res.writeHead(301, {'Location': appUrl})
  res.end()
}).listen(80)
