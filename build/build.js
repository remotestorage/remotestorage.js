var fs=require('fs'),
  requirejs = require('requirejs');
var configNode = {
  baseUrl: '../src',
  name: 'remoteStorage',
  out: 'latest/remoteStorage-node.js',
  wrap: {
    startFile: 'start.frag',
    endFile:'endNode.frag'
  }
};
requirejs.optimize(configNode);

var configBrowser = configNode;
configBrowser.out='latest/remoteStorage.js';
configBrowser.wrap={
  startFile: 'start.frag',
  endFile:'end.frag'
};

requirejs.optimize(configBrowser, function (buildResponse) {
  //buildResponse is just a text output of the modules
  //included. Load the built file for the contents.
  //Use config.out to get the optimized file contents.
  var contents = fs.readFileSync(configBrowser.out, 'utf8');
});
