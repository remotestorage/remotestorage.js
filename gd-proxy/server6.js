var http = require('http')
  , https = require('https');

http.createServer(function (req, res) {
  console.log('REQ.URL:'+req.url);
  if(req.url.length < 2) {
    console.log('no token here.');
    res.writeHead(200);
    res.end
      ( '<script>document.write(\'<a href="?\'+window.location.hash.substring(1)+\'">move hash to query</a> \');</script>'
      + '<a href="'
      + 'https://accounts.google.com/o/oauth2/auth?'
      + 'client_id=709507725318-4h19nag3k4hv5osj1jvao0j3an3bu43t@developer.gserviceaccount.com&'
      + 'redirect_uri=http://myfavouritesandwich.org:9000/&'
      + 'scope=http://docs.google.com/feeds/&'
      + 'response_type=token'
      + '">click</a>');
  } else {
    var token = req.url.substring(15, 74);
    console.log('TOKEN:'+token);
    var options =
      { 'host': 'docs.google.com'
      , 'port': 443
      , 'method': 'POST'
      , 'path': '/feeds/default/private/full'
      , 'headers':
         { 'GData-Version': '3.0'
         , 'Authorization': 'Bearer '+token
         , 'Content-Length': '0'
         , 'Content-Type': 'text/plain'
         , 'Slug': 'LetsRide'
         , 'X-Upload-Content-Length': '30'
         , 'X-Upload-Content-Type': 'text/plain'
         }
      };
    var req2 = https.request(options, function(res2) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'});
      res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2));
      res.write('\nSTATUS: ' + res2.statusCode);
      res.write('\nHEADERS: ' + JSON.stringify(res2.headers));
      res2.setEncoding('utf8');
      res2.on('data', function (chunk) {
        res.write('\nBODY: ' + chunk);
    res.end();
      });
    });
    req2.end();
  }
}).listen(9000);
