var http = require('http'),
  url = require('url'),
  path = require('path'),
  fs = require('fs'),
  config = require('./config').config;
 
function serve(req, res) {
  var uri = url.parse(req.url).pathname
    .replace(new RegExp('/$', 'g'), '/index.html');
  var host = req.headers.host;
  if(config.redirect && config.redirect[host]) {
    res.writeHead(302, {'Location': 'http://'+config.redirect[host]});
    res.write('302 Location: http://'+config.redirect[host]+'\n');
    res.end();
    return;
  }
  console.log(host);
  var filename = path.join(config.domainsDir, host, uri);
  if(filename.substring(0, config.domainsDir.length) != config.domainsDir) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.write('403 Naughty!\n'+filename);
    res.end();
    return;
  }
  var contentType;
  if(/\.appcache$/g.test(uri)) {
    contentType='text/cache-manifest';
  } else if(/\.html$/g.test(uri)) {
    contentType='text/html';
  } else if(/\.css$/g.test(uri)) {
    contentType='text/css';
  } else if(/\.js$/g.test(uri)) {
    contentType='text/javascript';
  } else if(/\.png$/g.test(uri)) {
    contentType='image/png';
  } else {
    contentType='text/plain';
  }
  path.exists(filename, function(exists) { 
    if(!exists) { 
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.write('404 Not Found\n'+filename);
      res.end();
      return;
    } 
 
    fs.readFile(filename, 'binary', function(err, file) {
      if(err) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end(err + '\n');
        return;
      }

      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': contentType
      });
      res.write(file, 'binary');
      res.end();
    });
  })
}

http.createServer(serve).listen(config.backends.statics);
console.log('Server running at ports '+config.backends.statics); 
