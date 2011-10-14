var http = require('http')
  , https = require('https');

  //////////////
 // test app //
//////////////

http.createServer(function (req, res) {
  console.log('WEB HIT');
  res.writeHead(200);
  res.end
    ( '<html>\n'
    + '<script>\n'
    + 'function testPut() {\n'
    + '  var token = window.location.hash.substring(14, 74);\n'
    + '  var xhr = new XMLHttpRequest();\n'
    + '  xhr.open(\'PUT\', \'http://myfavouritesandwich.org:9002/\', true);\n'
    + '  xhr.onreadystatechange=function() {\n'
    + '    if(xhr.status=200) {\n'
    + '      \n'
    + '      \n'
    + '      \n'
    + '    }\n'
    + '  };\n'
    + '  xhr.setRequestHeader(\'Authorization\', \'Bearer \'+token);\n'
    + '  xhr.send(\'blabla\');\n'
    + '}\n'
    + '</script>\n'
    + '<a href="" onclick="testPut();">test PUT</a>\n'
    + '<a href="'
    + 'https://accounts.google.com/o/oauth2/auth?'
    + 'client_id=709507725318-4h19nag3k4hv5osj1jvao0j3an3bu43t@developer.gserviceaccount.com&'
    + 'redirect_uri=http://myfavouritesandwich.org:9000/&'
    + 'scope=http://docs.google.com/feeds/&'
    + 'response_type=token'
    + '">click</a>\n'
    + '</html>\n');
}).listen(9000);

  ////////////////////////////////
 // gdata-remoteStorage bridge //
////////////////////////////////

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
    var responseHeaders = res2.headers;
    //add CORS to response:
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE';
    responseHeaders['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Authorization';
    res.writeHead(res2.statusCode, responseHeaders);
    res2.setEncoding('utf8');
    res2.on('data', function (chunk) {
      res.write(chunk);
      res.end();
    });
  });
  req2.end();
  console.log(JSON.stringify(options.headers));
}).listen(9002);
