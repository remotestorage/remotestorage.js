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
doBuild('remoteStorage-debug', 'startDebug.frag', 'remoteStorage', 'end.frag', true);
