var http = require('http')
  , https = require('https');

  //////////////////////
 // gdata CORS proxy //
//////////////////////

http.createServer(function (req, res) {
  console.log('REQ.URL:'+req.url);
  console.log('REQ.HEADERS:'+JSON.stringify(req.headers));
  var token;
  if(req.headers['authorization']) {
    token = req.headers['authorization'].substring(7);
  } else if(req.headers['Authorization']) {
    token = req.headers['Authorization'].substring(7);
  }
  console.log('TOKEN:'+token);
  var options =
    { 'host': 'docs.google.com'
    , 'port': 443
    , 'method': 'POST'
    , 'path': '/feeds/default/private/full?alt=json'
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
    var responseHeaders = res2.headers;
    //add CORS to response:
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE';
    responseHeaders['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Authorization';
    //replace status with 200:
    //res.writeHead(res2.statusCode, responseHeaders);
    responseHeaders['X-Status'] = res2.statusCode;
    res.writeHead(200, responseHeaders);
    res.write('responding:');
    res2.setEncoding('utf8');
    res2.on('data', function (chunk) {
      console.log(chunk);
      res.write(chunk);
      res.end(':gnidnopser');
    });
  });
  req2.end();
  console.log(JSON.stringify(options.headers));
}).listen(9002);
