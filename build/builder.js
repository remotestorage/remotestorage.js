var fs = require('fs');

exports.build = function(components, selectedGroups, options) {
  var files = [];
  selectedGroups.forEach(function(group) {
    if(components.groups[group]) {
      files = files.concat(components.groups[group].files);
    }
  });
  var output = '';
  files.forEach(function(file) {
    console.error("Adding file: " + file);
    output += '\n/** FILE: ' + file + ' **/\n'
    output += fs.readFileSync(file, 'UTF-8');
    output += "\n";
  });
  if(options.amd) {
    output = 'define([], function() {\n' +
      output +
      'return new RemoteStorage();\n' +
      '});\n';
  } else {
    output += 'remoteStorage = new RemoteStorage();'
  }
  return output;
};
