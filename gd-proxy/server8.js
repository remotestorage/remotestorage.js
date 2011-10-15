var http = require('http')
  , https = require('https');

  //////////////////////
 // gdata CORS proxy //
//////////////////////

http.createServer(function (req, res) {
  var dataStr = '';
  req.on('data', function(chunk) {
    dataStr += chunk;
  });
  req.on('end', function() {
    console.log('\nA.URL:'+req.url);
    console.log('\nA.METHOD:'+req.method);
    console.log('\nA.HEADERS:'+JSON.stringify(req.headers));
    console.log('\nA.DATA:'+dataStr);
    var options =
      { 'host': 'docs.google.com'
      , 'port': 443
      , 'method': req.method
      , 'path': req.url
      , 'headers': req.headers
      };
    options.headers.origin = 'http://myfavouritesandwich.org';
    options.headers['access-control-request-method'] = undefined;
    options.headers['access-control-request-headers'] = undefined;
    options.headers.host = undefined;
    
    var req2 = https.request(options, function(res2) {
      var responseHeaders = res2.headers;
      console.log('\nC.HEADERS:'+JSON.stringify(responseHeaders));
      //add CORS to response:
      responseHeaders['Access-Control-Allow-Origin'] = 'http://example.com';
      responseHeaders['Access-Control-Allow-Method'] = 'POST';
      responseHeaders['Access-Control-Allow-Headers'] = 'authorization,content-type,Content-Length,gdata-version,slug,x-upload-content-length,x-upload-content-type';
      responseHeaders['Access-Control-Allow-Credentials'] = 'true';
      //replace status with 200:
      responseHeaders['X-Status'] = res2.statusCode;
      console.log('\nD.HEADERS:'+JSON.stringify(responseHeaders));
      res.writeHead(200, responseHeaders);
      res2.setEncoding('utf8');
      var res2Data = '';
      res.write('START!');
      res2.on('data', function (chunk) {
        res2Data += chunk;
        res.write(chunk);
        res.write('DATA!');
        res.end();//FIXME:this is wrong here
      });
      res2.on('end', function() {
        console.log('\nC.DATA:'+res2Data);
        res.write('END!');
        res.end();
      });
    });
    req2.write(dataStr);
    req2.end();
  });
}).listen(9002);
