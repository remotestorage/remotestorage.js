
var http = require('http');
var requirejs = require('requirejs');
var availableModules = require('./modules');
var fs = require('fs'), path = require('path');

var MODULE_NAMES = [], MODULE_NAME_MAP = {};
availableModules.forEach(function(mod) {
  MODULE_NAMES.push(mod.name);
  MODULE_NAME_MAP[mod.name] = true;
});

var VERSION = fs.readSync(
  path.join(__dirname, '..', 'VERSION')
).replace(/\s+/g, '');


var builder = {
  assemble: function(options, callback) {
    var errors = [], modules = [];

    if(options.modules && options.modules === 'all') {
      modules = MODULE_NAMES;
    } else if(options.modules) {
      modules = options.modules.split(',')
      modules.forEach(function(moduleName) {
        if(! MODULE_NAME_MAP[moduleName]) {
          errors.push("Unknown module: " + moduleName);
        }
      });
    }

    if(errors) {
      return callback(errors);
    }

    var targetName = 'remoteStorage' + VERSION;

    if(modules.length == MODULE_NAMES.length) {
      targetName += '-all-modules'
    } else if(modules.length > 0) {
      targetName += '-custom'
    }

    if(options.node) {
      targetName += '-node';
    }
    if(options.debug) {
      targetName += '-debug';
    }

    var sources = ;

  }
}

http.createServer(function(request, response) {

  builder.assemble(request.query, function(err, name, data) {
    if(err) {
      response.statusCode = 400;
      response.send(JSON.stringify(err));
    } else {
      response.send(output);
    }
  });

}).listen(1234);

