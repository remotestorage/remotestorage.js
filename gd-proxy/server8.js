var http = require('http')
  , https = require('https');

  //////////////////////
 // gdata CORS proxy //
//////////////////////

http.createServer(function (req, res) {
  console.log('\nREQ.URL:'+req.url);
  console.log('\nREQ.METHOD:'+req.method);
  console.log('\nREQ.HEADERS:'+JSON.stringify(req.headers));
  var options =
    { 'host': 'docs.google.com'
    , 'port': 443
    , 'method': req.method
    , 'path': req.url
    , 'headers': req.headers
    };
  var req2 = https.request(options, function(res2) {
    var responseHeaders = res2.headers;
    //add CORS to response:
    if(req.headers['origin']) {
      responseHeaders['Access-Control-Allow-Origin'] = req.headers['origin'];
    } else {
      responseHeaders['Access-Control-Allow-Origin'] = '*';
    }

    if(req.headers['access-control-request-method']) {
      responseHeaders['Access-Control-Allow-Methods'] = req.headers['access-control-request-method'];
    } else {
      responseHeaders['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE';
    }
    if(req.headers['access-control-request-headers']) {
      responseHeaders['Access-Control-Allow-Headers'] = req.headers['access-control-request-headers'];
    } else {
      responseHeaders['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Authorization';
    }
    responseHeaders['Access-Control-Allow-Credentials'] = 'true';
    //replace status with 200:
    responseHeaders['X-Status'] = res2.statusCode;
    console.log('\nRES.HEADERS:'+JSON.stringify(responseHeaders));
    res.writeHead(200, responseHeaders);
    res.write('responding:');
    res2.setEncoding('utf8');
    res2.on('data', function (chunk) {
      console.log(chunk);
      res.write(chunk);
      res.end(':responding');
    });
  });
  req2.end();
}).listen(9002);
