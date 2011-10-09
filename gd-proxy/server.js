//#curl -X 'POST' -v -i -H "Content-Length: 0" -H "Content-Type: text/plain" -H "Slug: LetsRide" -H "X-Upload-Content-Length: 30" -H "X-Upload-Content-Type: text/plain" https://docs.google.com/feeds/default/private/full/?convert=false\&access_token=TOKEN\&v=3
//#curl -X 'POST' -v -i -H "GData-Version: 3.0" -H "Authorization: Bearer TOKEN" -H "Content-Length: 0" -H "Content-Type: text/plain" -H "Slug: LetsRide" -H "X-Upload-Content-Length: 30" -H "X-Upload-Content-Type: text/plain" https://docs.google.com/feeds/default/private/full
//curl -v -i -H "GData-Version: 3.0" -H "Authorization: Bearer TOKEN" -H "Content-Type: text/plain" -H "Content-Range: bytes 0 - 29/30" https://docs.google.com/feeds/default/private/full/document%3DOCNAME -d one\ two\ three\ microphone\ check

var httpProxy = require('http-proxy')
  , http = require('http')

httpProxy.createServer(function(req, res, proxy) {
  console.log(JSON.stringify(req.method))
  req.headers.host='docs.google.com'
  console.log(JSON.stringify(req.headers))
  if(req.method=='OPTIONS') {
    //proxy.proxyRequest(req, res, {host: 'localhost', port: 9000})
    proxy.proxyRequest(req, res, {host: 'yourremotestorage.com', port: 80})
  } else {
    proxy.proxyRequest(req, res, {host: 'docs.google.com', port: 80})
  }
}).listen(8080)
console.log('gd-proxy running at port 8080') 
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'});
  res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);
