
var MODULES = {
  files: {
    'promising.js': 'A Promises/A+ implementation',
    'remotestorage.js': 'Basic GET/PUT/DELETE client',
    'remotestorage.discover.js': 'Webfinger client',
    'remotestorage.authorize.js': 'OAuth2 client',
    'remotestorage.indexeddb.js': 'IndexedDB caching layer',
    'remotestorage.sync.js': 'Synchronizes remotestorage and local cache',
    'remotestorage.widget.js': '"Connect" widget, managing discovery and authorization',
    'remotestorage.inspect.js': 'Debugging widget that displays local and remote data',
  },
  groups: {
    core: {
      label: "Core",
      desc: "Basic requirements to connect to a remotestorage server and send / receive data.",
      files: ['promising.js', 'remotestorage.js', 'remotestorage.discover.js', 'remotestorage.authorize.js'],
      required: true
    },
    caching: {
      label: "Caching",
      desc: "Local caching layer and synchronization",
      files: ['remotestorage.indexeddb.js', 'remotestorage.sync.js'],
      initial: true
    },
    widget: {
      label: "Widget",
      desc: '"Connect" widget, managing discovery and authorization',
      files: ['remotestorage.widget.js'],
      initial: true
    },
    debug: {
      label: "Debug",
      desc: "Debugging tools, useful for development",
      files: ['remotestorage.inspect.js']
    }
  }
};

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
  if(req.method === 'GET') {
    res.writeHead(200, extend({'Content-Type':'application/json'}, CORS_HEADERS));
    res.write(JSON.stringify(MODULES));
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
      for(var key in MODULES.groups) {
        if(MODULES.groups[key].required) {
          groups.unshift(key);
        }
      }
      var files = [];
      groups.forEach(function(group) {
        if(MODULES.groups[group]) {
          files = files.concat(MODULES.groups[group].files);
        }
      });
      res.writeHead(200, extend({'Content-Type':'text/javascript','Content-Disposition':'attachment;filename=remotestorage.js'}, CORS_HEADERS));
      function streamOne() {
        var file = files.shift();
        if(file) {
          fs.readFile(FILE_ROOT + file, function(err, data) {
            if(err) {
              console.log("failed to read file: ", err);
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
