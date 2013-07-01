
var FILE_ROOT = "../"

var http = require('http');
var qs = require('querystring');
var fs = require('fs');

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Expose-Headers': 'Content-Type'
}

function extend(a, b) {
  for(var key in b) {
    a[key] = b[key];
  }
  return a;
}

http.createServer(function(req, res) {
  var components = JSON.parse(fs.readFileSync('components.json'));
  if(req.method === 'GET') {
    res.writeHead(200, extend({'Content-Type':'application/json'}, CORS_HEADERS));
    res.write(JSON.stringify(components));
    res.end();
  } else if(req.method === 'POST') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      var params = qs.parse(body);
      var groups = params.groups;
      if(! (groups instanceof Array)) {
        groups = [groups];
      }
      for(var key in components.groups) {
        if(components.groups[key].required) {
          groups.unshift(key);
        }
      }
      var files = [];
      groups.forEach(function(group) {
        if(components.groups[group]) {
          files = files.concat(components.groups[group].files);
        }
      });
      res.writeHead(200, extend({'Content-Type':'text/javascript','Content-Disposition':'attachment;filename=remotestorage.js'}, CORS_HEADERS));
      function streamOne() {
        var file = files.shift();
        if(file) {
          fs.readFile(FILE_ROOT + file, function(err, data) {
            if(err) {
              console.log("failed to read file: ", err);
              res.write('\n/* FILE NOT FOUND: ' + file + ' */\n');
            } else {
              res.write(data);
            }
            streamOne();
          });
        } else {
          res.end();
        }
      }
      streamOne();
    });
  } else if(req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
  } else {
    res.writeHead(400, CORS_HEADERS);
    res.end();
  }
}).listen(8000);
