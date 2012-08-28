var fs=require('fs'),
  requirejs = require('requirejs');

//normal build:
var config = {
  baseUrl: '../src',
  wrap: {
    startFile: 'start.frag',
    endFile:'end.frag'
  },
};

function doBuild(output, startFrag, name, endFrag, debug) {

  if(!! debug) {
    config.optimize = 'none';
  } 

  config.wrap.startFile = startFrag;
  config.name = name;
  config.wrap.endFile = endFrag;
  config.out = 'latest/' + output + '.js';

  console.log((!!debug) ? 'DEBUG' : 'OPTIMIZED', name, '->', config.out);

  requirejs.optimize(config);

  delete config.optimize;
}

// remoteStorage build
doBuild('remoteStorage', 'start.frag', 'remoteStorage', 'end.frag');
doBuild('remoteStorage-debug', 'startDebug.frag', 'remoteStorage', 'end.frag', true);
doBuild('remoteStorage-node', 'start.frag', 'remoteStorage', 'endNode.frag');

// modules build
doBuild('remoteStorage-modules', 'start.frag', 'remoteStorage-modules', 'endModules.frag');
// set of modules, not optimized.
doBuild('remoteStorage-modules-debug', 'startDebug.frag', 'remoteStorage-modules', 'endModules.frag', true);

// combined build
doBuild('remoteStorage-with-modules', 'start.frag', 'remoteStorage-with-modules', 'end.frag');
doBuild('remoteStorage-with-modules-debug', 'startDebug.frag', 'remoteStorage-with-modules', 'end.frag', true);
