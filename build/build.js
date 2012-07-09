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

//   //debug build:
//   config.optimize = 'none';
//   config.wrap.startFile = 'startDebug.frag';
//   config.wrap.endFile = 'end.frag';
//   config.out = 'latest/' + name + '-debug.js';

//   //node build:
//   requirejs.optimize(config);
//   delete config.optimize;
//   config.out = 'latest/' + name + '-node.js';
//   config.wrap.startFile = 'start.frag';
//   config.wrap.endFile = 'endNode.frag';
//   requirejs.optimize(config);

// }

doBuild('remoteStorage', 'start.frag', 'remoteStorage', 'end.frag');
doBuild('remoteStorage-debug', 'startDebug.frag', 'remoteStorage', 'end.frag', true);
doBuild('remoteStorage-node', 'start.frag', 'remoteStorage', 'endNode.frag');
doBuild('remoteStorage-modules', 'start.frag', 'remoteStorage-modules', 'endModules.frag');
doBuild('remoteStorage-modules-debug', 'start.frag', 'remoteStorage-modules', 'endModules.frag', true);
