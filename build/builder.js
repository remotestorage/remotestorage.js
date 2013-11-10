var fs = require('fs');

exports.build = function(components, selectedGroups, options) {
  var output = '';

  global.RemoteStorage = function() {};
  eval(fs.readFileSync('./src/version.js', 'UTF-8'));
  var version = RemoteStorage.version;
  delete global.RemoteStorage;

  output += "/** " + version.toString() + ", http://remotestorage.io, MIT-licensed **/\n"

  console.error("Building version " + version.toString());

  if(options.amd) {
    console.error("AMD build: starting define() block.");
    output += 'define([], function() {\n';
  }

  var files = [];
  selectedGroups.forEach(function(group) {
    if(components.groups[group]) {
      files = files.concat(components.groups[group].files);
    }
  });
  files.forEach(function(file) {
    console.error("Adding file: " + file);
    output += '\n/** FILE: ' + file + ' **/\n'
    output += fs.readFileSync(file, 'UTF-8');
    output += "\n";
  });
  if(options.amd) {
    console.error("AMD build: ending define() block.");
    output += 'return new RemoteStorage();\n});\n';
  } else if(options.node) {
    console.error("CommonJS/AMD build: exporting 'RemoteStorage'.");
    output += "if(typeof(define) == 'function' && define.amd) define([], function() { return RemoteStorage }); else module.exports = RemoteStorage;\n";
  } else {
    console.error("Browser build: adding global 'remoteStorage' object.");
    output += 'remoteStorage = new RemoteStorage();'
  }
  return output;
};
