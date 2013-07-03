var fs = require('fs');

exports.build = function(components, selectedGroups) {
  var files = [];
  selectedGroups.forEach(function(group) {
    if(components.groups[group]) {
      files = files.concat(components.groups[group].files);
    }
  });
  var output = '';
  files.forEach(function(file) {
    console.error("Adding file: " + file);
    output += fs.readFileSync(file, 'UTF-8');
    output += "\n";
  });
  output += 'remoteStorage = new RemoteStorage();'
  return output;
};
