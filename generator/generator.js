
function generateCode(remoteStorage) {
  var output = "";
  if(remoteStorage.access.scopes.length > 0) {
    output
      += "remoteStorage.claimAccess({\n"
      + remoteStorage.access.scopes.map(function(scope) {
        return '  "' + scope.name + '": ' + '"' + scope.mode + '"';
      }).join(",\n")
      + "\n});\n";
  }
  if(remoteStorage.caching.rootPaths.length > 0) {
    output += remoteStorage.caching.rootPaths.map(function(path) {
      return 'remoteStorage.caching.enable("' + path + '");';
    }).join("\n");
  }
  return output;
}
