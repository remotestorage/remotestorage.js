var domainsDir = 'domains/'
var sslDir = '/root/ssl-cert/'

var http = require('http')
  , https = require('https')
  , url = require('url')
  , path = require('path')
  , fs = require('fs')
 
var ssl =
  { ca:fs.readFileSync(sslDir +'sub.class1.server.ca.pem')
  , key:fs.readFileSync(sslDir +'ssl.key')
  , cert:fs.readFileSync(sslDir +'ssl.crt')
  }
function serve(req, res) {
  var uri = url.parse(req.url).pathname
    .replace(new RegExp('/$', 'g'), '/index.html')
  var host = req.headers.host
console.log(host)
  host = host
    .replace(new RegExp('([a-f0-9]+)\.apptorrent\.net', 'g'), 'apptorrent.net')//wildcard hosting
console.log('>:'+host)
  var filename = path.join(domainsDir, host, uri)
  if(filename.substring(0, domainsDir.length) != domainsDir) {
    res.writeHead(403, {'Content-Type': 'text/plain'})
    res.write('403 Naughty!\n'+filename)
    res.end()
    return
  }
  var contentType
  if(/\.appcache$/g.test(uri)) {
    contentType='text/cache-manifest'
  } else {
    contentType='text/html'
  }
  path.exists(filename, function(exists) { 
    if(!exists) { 
      res.writeHead(404, {'Content-Type': 'text/plain'})
      res.write('404 Not Found\n'+filename)
      res.end()
      return
    } 
 
    fs.readFile(filename, 'binary', function(err, file) {
      if(err) {
        res.writeHead(500, {'Content-Type': 'text/plain'})
        res.end(err + '\n')
        return
      }

      res.writeHead(200, 
        { 'Access-Control-Allow-Origin': '*'
        , 'Access-Control-Allow-Headers': 'Content-Type'
        //, 'Content-Type': contentType
        })
      res.write(file, 'binary')
      res.end()
    })
  })
}

http.createServer(serve).listen(80)
https.createServer(ssl, serve).listen(443)
console.log('Server running at ports 80 and 443') 
//console.log('Server running at port 80') 
